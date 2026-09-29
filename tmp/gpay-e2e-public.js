// tmp/gpay-e2e-public.js
// Verifies the GPay public "new_application" flow end-to-end: a signed webhook
// must rebuild the payer context from the stored PaymentIntent payload and drive
// completeNewApplicationAfterPayment (user -> application -> invoice -> payment -> receipt).
//
// Real SMS/email are avoided by temporarily disabling the target user's
// notification preferences and restoring them afterwards.

require('dotenv/config');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3004';
const WEBHOOK_URL = `${BASE}/api/v1/payments/gpay/webhook`;
const SECRET = (process.env.GPAY_WEBHOOK_SECRET || '').trim();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(obj) {
  const raw = Buffer.from(JSON.stringify(obj), 'utf8');
  const signature = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GPay-Signature': signature },
    body: raw,
  });
  return { status: res.status, text: await res.text() };
}

function webhookBody(reference, amount) {
  const gpayRef = `GPAY_MC_E2E_PUB_${Date.now()}`;
  return {
    event: 'charge.success',
    data: {
      gpay_reference: gpayRef,
      merchant_transaction_ref: reference,
      status: 'successful',
      amount,
      currency: 'NGN',
      gateway_name: 'Mastercard MPGS',
      gateway_reference: 'AUTH_E2E_PUB_1',
      order_id: gpayRef,
      mastercard_session_id: 'SESSION0002951568084F81658240J7',
      paid_at: '2026-09-29 12:30:00',
    },
  };
}

async function main() {
  const service = await prisma.service.findFirst({
    where: { isActive: true, feeConfig: { status: 'ACTIVE' } },
    include: { feeConfig: true },
  });
  if (!service) throw new Error('No active service with an ACTIVE feeConfig');

  // Existing citizen user, so no new account is created and no "account created"
  // notification fires.
  const user = await prisma.user.findFirst({
    where: { role: 'citizen' },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error('No citizen user to act as the payer');

  const amount = Number(service.feeConfig.amount);
  console.log(`Base URL : ${BASE}`);
  console.log(`Service  : ${service.name} (${service.code}) fee=${amount}`);
  console.log(`Payer    : ${user.email}\n`);

  const originalPrefs = {
    notifyByEmail: user.notifyByEmail,
    notifyBySms: user.notifyBySms,
  };
  const startedAt = new Date();

  let reference;

  try {
    // Silence real SMS/email for this test only.
    await prisma.user.update({
      where: { id: user.id },
      data: { notifyByEmail: false, notifyBySms: false },
    });

    reference = `PAY-E2E-PUB-${Date.now()}`;

    const intent = await prisma.paymentIntent.create({
      data: {
        reference,
        provider: 'gpay',
        flow: 'new_application',
        amount,
        currency: 'NGN',
        status: 'pending',
        checkoutUrl: 'https://gpay.gfa-tech.com/payment/checkout/E2E-PUB',
        payload: {
          flow: 'new_application',
          serviceId: service.id,
          serviceCode: service.code,
          serviceName: service.name,
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone || '08000000000',
          userId: user.id,
        },
      },
    });

    const res = await post(webhookBody(reference, amount.toFixed(2)));
    check('public flow → signed webhook accepted (200)', res.status === 200, `http ${res.status}`);

    await sleep(3500);

    const afterIntent = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
    check(
      'public flow → intent confirmed',
      afterIntent?.status === 'confirmed',
      `status=${afterIntent?.status}`,
    );

    const application = await prisma.application.findFirst({
      where: { serviceId: service.id, applicantId: user.id, createdAt: { gte: startedAt } },
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    });
    check('public flow → application created', !!application, `id=${application?.id}`);
    check(
      'public flow → application status awaiting_form',
      application?.status === 'awaiting_form',
      `status=${application?.status}`,
    );
    check(
      'public flow → application linked to the payer',
      application?.applicantId === user.id,
      `applicantId=${application?.applicantId}`,
    );
    check(
      'public flow → application feeAmount matches service fee',
      Number(application?.feeAmount) === amount,
      `feeAmount=${application?.feeAmount}`,
    );

    const invoice = application?.invoice;
    check('public flow → invoice created', !!invoice, `number=${invoice?.invoiceNumber}`);
    check(
      'public flow → invoice amount matches service fee',
      Number(invoice?.amount) === amount,
      `amount=${invoice?.amount}`,
    );
    check(
      'public flow → invoice paymentStatus confirmed',
      invoice?.paymentStatus === 'confirmed',
      `status=${invoice?.paymentStatus}`,
    );

    const payment = invoice
      ? await prisma.payment.findFirst({
          where: { invoiceId: invoice.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    check(
      'public flow → payment row confirmed',
      payment?.status === 'confirmed',
      `status=${payment?.status}`,
    );
    check(
      'public flow → payment reference is our GPay reference',
      payment?.reference === reference,
      `reference=${payment?.reference}`,
    );

    const receipt = invoice
      ? await prisma.receipt.findUnique({ where: { invoiceId: invoice.id } })
      : null;
    check('public flow → receipt issued', !!receipt, `number=${receipt?.receiptNumber}`);
    check(
      'public flow → receipt amountPaid matches',
      Number(receipt?.amountPaid) === amount,
      `amountPaid=${receipt?.amountPaid}`,
    );

    // ── Cleanup ────────────────────────────────────────────────
    if (receipt) await prisma.receipt.delete({ where: { id: receipt.id } });
    if (payment) await prisma.payment.delete({ where: { id: payment.id } });
    if (invoice) await prisma.invoice.delete({ where: { id: invoice.id } });
    if (application) await prisma.application.delete({ where: { id: application.id } });
    await prisma.paymentIntent.delete({ where: { id: intent.id } });
    console.log('\nTest data cleaned up.');
  } finally {
    await prisma.user.update({ where: { id: user.id }, data: originalPrefs });
    console.log(
      `Notification preferences restored (email=${originalPrefs.notifyByEmail}, sms=${originalPrefs.notifyBySms}).`,
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Public-flow harness error:', err);
  await prisma.$disconnect();
  process.exit(1);
});

