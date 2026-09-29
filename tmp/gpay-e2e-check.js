// tmp/gpay-e2e-check.js
// End-to-end verification of the GPay webhook / verify / route wiring.
// Requires the dev server to be running on E2E_BASE_URL (default localhost:3004).
// Creates its own throwaway application + invoice and cleans up afterwards.

require('dotenv/config');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3004';
const WEBHOOK_URL = `${BASE}/api/v1/payments/gpay/webhook`;
const VERIFY_URL = `${BASE}/api/v1/payments/gpay/verify`;
const PUBLIC_INIT_URL = `${BASE}/api/v1/payments/gpay/public/initialize`;
const INVOICE_INIT_URL = `${BASE}/api/v1/payments/gpay/initialize`;
const SECRET = (process.env.GPAY_WEBHOOK_SECRET || '').trim();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function body(reference, amount, status = 'successful', event = 'charge.success') {
  const gpayRef = `GPAY_MC_E2E_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    event,
    data: {
      gpay_reference: gpayRef,
      merchant_transaction_ref: reference,
      status,
      amount,
      currency: 'NGN',
      gateway_name: 'Mastercard MPGS',
      gateway_reference: 'AUTH_E2E_000001',
      order_id: gpayRef,
      mastercard_session_id: 'SESSION0002951568084F81658240J7',
      paid_at: '2026-09-29 12:30:00',
    },
  };
}

async function post(obj, { encoding = 'hex', tamper = false, omitHeader = false } = {}) {
  const raw = Buffer.from(JSON.stringify(obj), 'utf8');
  const signed = tamper ? Buffer.from(`${raw.toString('utf8')} `, 'utf8') : raw;
  const signature = crypto.createHmac('sha256', SECRET).update(signed).digest(encoding);
  const headers = { 'Content-Type': 'application/json' };
  if (!omitHeader) headers['X-GPay-Signature'] = signature;
  const res = await fetch(WEBHOOK_URL, { method: 'POST', headers, body: raw });
  return { status: res.status, text: await res.text() };
}

/** Replicates exactly what initializeGpayInvoicePayment writes before the redirect. */
async function seedInvoiceFlow(service, user) {
  const application = await prisma.application.create({
    data: {
      applicationNumber: `E2E-APP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serviceId: service.id,
      feeAmount: 100,
      formData: {},
      status: 'awaiting_form',
      applicantId: null,
      createdById: null,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `E2E-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      applicationId: application.id,
      serviceId: service.id,
      amount: 100,
      paymentStatus: 'pending',
    },
  });

  const reference = `PAY-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const intent = await prisma.paymentIntent.create({
    data: {
      reference,
      provider: 'gpay',
      flow: 'invoice_online',
      amount: 100,
      currency: 'NGN',
      status: 'pending',
      invoiceId: invoice.id,
      checkoutUrl: 'https://gpay.gfa-tech.com/payment/checkout/E2E',
      payload: {
        flow: 'invoice_online',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone || '08000000000',
      },
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 100,
      method: 'online_gateway',
      status: 'pending',
      reference,
      paidById: user.id,
    },
  });

  return { application, invoice, intent, reference };
}

async function main() {
  console.log(`Base URL : ${BASE}`);
  console.log(`Secret   : ${SECRET ? `set (${SECRET.length} chars)` : 'MISSING'}`);
  console.log('');

  // ── HTTP-level checks that need no fixture ──────────────────
  const noRef = await fetch(`${VERIFY_URL}/DOES-NOT-EXIST`);
  const noRefBody = await noRef.json().catch(() => ({}));
  check(
    'verify → unknown reference returns 404 NOT_FOUND',
    noRef.status === 404 && noRefBody?.error?.code === 'NOT_FOUND',
    `http ${noRef.status} code ${noRefBody?.error?.code}`,
  );

  const badSig = await post(body('PAY-E2E-NOPE', '100.00'), { tamper: true });
  check('webhook → tampered signature rejected with 401', badSig.status === 401, `http ${badSig.status}`);

  const noSig = await post(body('PAY-E2E-NOPE', '100.00'), { omitHeader: true });
  check('webhook → missing signature rejected with 401', noSig.status === 401, `http ${noSig.status}`);

  const unknownRef = await post(body('PAY-E2E-UNKNOWN-REF', '100.00'));
  check(
    'webhook → valid signature + unknown reference accepted (200) and ignored',
    unknownRef.status === 200,
    `http ${unknownRef.status}`,
  );

  const badBody = await fetch(PUBLIC_INIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId: '', fullName: '', email: 'nope', phone: '1' }),
  });
  const badBodyJson = await badBody.json().catch(() => ({}));
  check(
    'public/initialize → zod validation rejects bad body (400 VALIDATION_ERROR)',
    badBody.status === 400 && badBodyJson?.error?.code === 'VALIDATION_ERROR',
    `http ${badBody.status} code ${badBodyJson?.error?.code}`,
  );

  const unauthInit = await fetch(`${INVOICE_INIT_URL}/SOME-INVOICE`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const unauthJson = await unauthInit.json().catch(() => ({}));
  check(
    'initialize/:invoiceNumber → requires auth (401 UNAUTHORIZED)',
    unauthInit.status === 401 && unauthJson?.error?.code === 'UNAUTHORIZED',
    `http ${unauthInit.status} code ${unauthJson?.error?.code}`,
  );

  // ── Fixture ─────────────────────────────────────────────────
  const service = await prisma.service.findFirst({
    where: { isActive: true, feeConfig: { status: 'ACTIVE' } },
    include: { feeConfig: true },
  });
  if (!service) throw new Error('No active service with an ACTIVE feeConfig found');

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('No user found to act as the payer');

  console.log(`\nFixture: service="${service.name}" payer="${user.email}"\n`);

  const flow = await seedInvoiceFlow(service, user);

  // ── Happy path ──────────────────────────────────────────────
  const ok = await post(body(flow.reference, '100.00'));
  check('webhook → valid signed charge.success accepted (200)', ok.status === 200, `http ${ok.status}`);

  await sleep(2000);

  const afterIntent = await prisma.paymentIntent.findUnique({ where: { id: flow.intent.id } });
  const afterInvoice = await prisma.invoice.findUnique({ where: { id: flow.invoice.id } });
  const afterPayment = await prisma.payment.findUnique({ where: { reference: flow.reference } });
  const receipts = await prisma.receipt.findMany({ where: { invoiceId: flow.invoice.id } });

  check('intent → status "confirmed"', afterIntent?.status === 'confirmed', `status=${afterIntent?.status}`);
  check('intent → gpayReference stored', !!afterIntent?.gpayReference, `${afterIntent?.gpayReference}`);
  check(
    'intent → gatewayReference stored',
    afterIntent?.gatewayReference === 'AUTH_E2E_000001',
    `${afterIntent?.gatewayReference}`,
  );
  check('intent → paidAt stamped', !!afterIntent?.paidAt, `${afterIntent?.paidAt}`);
  check('payment → status "confirmed"', afterPayment?.status === 'confirmed', `status=${afterPayment?.status}`);
  check(
    'payment → gatewayRef set to GPay reference',
    !!afterPayment?.gatewayRef && afterPayment.gatewayRef.startsWith('GPAY_MC_E2E_'),
    `${afterPayment?.gatewayRef}`,
  );
  check(
    'invoice → paymentStatus "confirmed"',
    afterInvoice?.paymentStatus === 'confirmed',
    `status=${afterInvoice?.paymentStatus}`,
  );
  check('receipt → generated exactly once', receipts.length === 1, `count=${receipts.length}`);
  check(
    'receipt → amountPaid 100',
    Number(receipts[0]?.amountPaid) === 100,
    `amountPaid=${receipts[0]?.amountPaid}`,
  );

  // ── Idempotency ─────────────────────────────────────────────
  const dup = await post(body(flow.reference, '100.00'));
  await sleep(1500);
  const receiptsAfter = await prisma.receipt.count({ where: { invoiceId: flow.invoice.id } });
  const paymentsAfter = await prisma.payment.count({ where: { invoiceId: flow.invoice.id } });
  check('duplicate webhook → still 200', dup.status === 200, `http ${dup.status}`);
  check('duplicate webhook → no second receipt', receiptsAfter === 1, `count=${receiptsAfter}`);
  check('duplicate webhook → no second payment row', paymentsAfter === 1, `count=${paymentsAfter}`);

  // ── Verify endpoint short-circuit ───────────────────────────
  const verifyDone = await fetch(`${VERIFY_URL}/${flow.reference}`);
  const verifyDoneJson = await verifyDone.json().catch(() => ({}));
  check(
    'verify → confirmed reference short-circuits without calling GPay',
    verifyDone.status === 200 && verifyDoneJson?.data?.status === 'confirmed',
    `http ${verifyDone.status} status=${verifyDoneJson?.data?.status}`,
  );

  // ── Amount guard ────────────────────────────────────────────
  const mismatch = await seedInvoiceFlow(service, user);
  const tampered = await post(body(mismatch.reference, '500.00'));
  await sleep(2000);
  const mismatchIntent = await prisma.paymentIntent.findUnique({ where: { id: mismatch.intent.id } });
  const mismatchReceipts = await prisma.receipt.count({ where: { invoiceId: mismatch.invoice.id } });
  check('amount mismatch → webhook still acknowledged (200)', tampered.status === 200, `http ${tampered.status}`);
  check(
    'amount mismatch → intent NOT confirmed',
    mismatchIntent?.status === 'pending',
    `status=${mismatchIntent?.status}`,
  );
  check('amount mismatch → no receipt issued', mismatchReceipts === 0, `count=${mismatchReceipts}`);

  // ── base64 signature encoding ───────────────────────────────
  const b64 = await post(body('PAY-E2E-B64-UNKNOWN', '100.00'), { encoding: 'base64' });
  check('webhook → base64 signature also accepted', b64.status === 200, `http ${b64.status}`);

  // ── Non-success status is not confirmed ─────────────────────
  const failedFlow = await seedInvoiceFlow(service, user);
  await post(body(failedFlow.reference, '100.00', 'failed'));
  await sleep(2000);
  const failedIntent = await prisma.paymentIntent.findUnique({ where: { id: failedFlow.intent.id } });
  check(
    'webhook → status "failed" does NOT confirm the intent',
    failedIntent?.status === 'pending',
    `status=${failedIntent?.status}`,
  );

  // ── Cleanup ─────────────────────────────────────────────────
  const invoiceIds = [flow.invoice.id, mismatch.invoice.id, failedFlow.invoice.id];
  await prisma.paymentIntent.deleteMany({ where: { reference: { startsWith: 'PAY-E2E-' } } });
  await prisma.receipt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.application.deleteMany({
    where: {
      id: { in: [flow.application.id, mismatch.application.id, failedFlow.application.id] },
    },
  });
  console.log('\nCleanup complete.');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed checks:');
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('E2E harness error:', err);
  await prisma.$disconnect();
  process.exit(1);
});

