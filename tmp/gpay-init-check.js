// tmp/gpay-init-check.js
// Exercises both real initiate routes against the GPay sandbox.
// Expected while GPAY_AUTH_SECRET is unset: the sandbox rejects the merchant API
// key (401), so our route must fail cleanly with PAYMENT_INITIALIZATION_FAILED,
// mark the intent as failed, and create no Payment row.

require('dotenv/config');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3004';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
}

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
}

async function main() {
  const startedAt = new Date();

  const user = await prisma.user.findFirst({ where: { isActive: true } });
  if (!user) throw new Error('No active user');

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      wardId: user.wardId || null,
      tokenVersion: user.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const invoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!invoice) throw new Error('No invoice found');
  console.log(`Using invoice ${invoice.invoiceNumber} (paymentStatus=${invoice.paymentStatus})\n`);

  const paymentsBefore = await prisma.payment.count({ where: { invoiceId: invoice.id } });

  // ── Authenticated invoice initiate ──────────────────────────
  const invRes = await json(
    await fetch(`${BASE}/api/v1/payments/gpay/initialize/${invoice.invoiceNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
    }),
  );
  console.log('invoice initiate response:', JSON.stringify(invRes.body), '\n');
  check(
    'invoice initiate → authenticated request reaches handler (not 401)',
    invRes.status !== 401,
    `http ${invRes.status}`,
  );
  check(
    'invoice initiate → clean PAYMENT_INITIALIZATION_FAILED while auth secret is missing',
    invRes.status === 400 && invRes.body?.error?.code === 'PAYMENT_INITIALIZATION_FAILED',
    `http ${invRes.status} code ${invRes.body?.error?.code}`,
  );

  // ── Public initiate ─────────────────────────────────────────
  const service = await prisma.service.findFirst({
    where: { isActive: true, feeConfig: { status: 'ACTIVE' } },
  });

  const pubRes = await json(
    await fetch(`${BASE}/api/v1/payments/gpay/public/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        fullName: 'E2E Initiate Tester',
        email: 'e2e.initiate@odeda.test',
        phone: '08099887766',
      }),
    }),
  );
  console.log('public initiate response:', JSON.stringify(pubRes.body), '\n');
  check(
    'public initiate → clean PAYMENT_INITIALIZATION_FAILED while auth secret is missing',
    pubRes.status === 400 && pubRes.body?.error?.code === 'PAYMENT_INITIALIZATION_FAILED',
    `http ${pubRes.status} code ${pubRes.body?.error?.code}`,
  );

  // ── Failure bookkeeping ─────────────────────────────────────
  const intents = await prisma.paymentIntent.findMany({
    where: { createdAt: { gte: startedAt } },
    orderBy: { createdAt: 'asc' },
  });
  check('failed initiates → PaymentIntent rows created', intents.length === 2, `count=${intents.length}`);
  check(
    'failed initiates → intents marked "failed"',
    intents.length === 2 && intents.every((i) => i.status === 'failed'),
    intents.map((i) => i.status).join(','),
  );
  check(
    'failed initiates → raw gateway response persisted for auditing',
    intents.every((i) => i.lastResponse !== null),
    intents.map((i) => (i.lastResponse ? 'yes' : 'no')).join(','),
  );
  check(
    'failed initiate → no Payment row created for the invoice',
    (await prisma.payment.count({ where: { invoiceId: invoice.id } })) === paymentsBefore,
    `before=${paymentsBefore} after=${await prisma.payment.count({ where: { invoiceId: invoice.id } })}`,
  );
  check(
    'failed initiate → invoice untouched',
    (await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.paymentStatus === invoice.paymentStatus,
    `status=${(await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.paymentStatus}`,
  );

  await prisma.paymentIntent.deleteMany({ where: { createdAt: { gte: startedAt } } });
  console.log('\nTest intents cleaned up.');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Initiate harness error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
