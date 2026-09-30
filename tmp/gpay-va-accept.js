/* eslint-disable */
// Acceptance suite for GPay reserved virtual accounts.
//   node tmp/gpay-va-accept.js
// Creates and removes its own fixtures; leaves the DB as it found it.
require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const API = "http://localhost:3004/api/v1";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let pass = 0;
let fail = 0;
const check = (label, ok, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + label + (ok ? "" : "   << " + detail));
  ok ? pass++ : fail++;
};

async function hit(method, url, opts = {}) {
  const headers = {};
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.sig !== undefined) headers["X-GPay-Signature"] = opts.sig;
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body === undefined ? undefined : opts.body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text };
}

const hmac = (raw, secret) =>
  crypto.createHmac("sha256", secret).update(raw).digest("hex");

// The webhook 200-acks BEFORE it processes (deliberately), so an HTTP client
// returns while the server is still writing. Give it time to land.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let fixtureService = null;
  let fixtureInvoice = null;
  const baseIntents = await p.paymentIntent.count();
  const basePayments = await p.payment.count();

  try {
    const secret = process.env.GPAY_WEBHOOK_SECRET;
    const svc = await p.service.findFirst({
      where: { code: "tenement_rate" },
      include: { feeConfig: true },
    });

    // ── 1. Public route, mapped service ────────────────────────────
    const r1 = await hit("GET", `${API}/payments/gpay/virtual-account?serviceId=${svc.id}`);
    check("public VA -> 200 for a mapped service", r1.status === 200, r1.status + " " + r1.text);
    const d = r1.json && r1.json.data;
    const keys = d ? Object.keys(d).sort().join(",") : "";
    check(
      "public VA exact allow-list (no total_settled/bank_code/created_at)",
      keys === "accountName,accountNumber,bankName,expectedAmount,reference",
      keys,
    );
    check("expectedAmount == configured fee", d && Number(d.expectedAmount) === Number(svc.feeConfig.amount), d && d.expectedAmount);
    check("account is the one reserved for TENEMENTR", d && d.accountNumber === "9653241600", d && d.accountNumber);
    check("bank is Providus", d && d.bankName === "Providus Bank", d && d.bankName);

    // ── 2. Validation ──────────────────────────────────────────────
    const r2 = await hit("GET", `${API}/payments/gpay/virtual-account`);
    check("missing serviceId -> 400 VALIDATION_ERROR", r2.status === 400 && r2.json?.error?.code === "VALIDATION_ERROR", r2.status + " " + r2.text);
    const r3 = await hit("GET", `${API}/payments/gpay/virtual-account?serviceId=nope`);
    check("unknown serviceId -> 404", r3.status === 404, r3.status + " " + r3.text);

    // ── 3. Reuse window ────────────────────────────────────────────
    const r4 = await hit("GET", `${API}/payments/gpay/virtual-account?serviceId=${svc.id}`);
    check("repeat call returns the SAME reference", r4.json?.data?.reference === d?.reference, r4.json?.data?.reference);
    const pendingRows = await p.payment.count({
      where: { serviceCode: "tenement_rate", status: "pending", method: "bank_transfer" },
    });
    check("repeat call minted no second pending Payment", pendingRows === 1, "rows=" + pendingRows);

    // ── 4. Unmapped service ────────────────────────────────────────
    fixtureService = await p.service.create({
      data: {
        code: "zz_va_unmapped_test",
        name: "VA Unmapped Fixture",
        category: "CERTIFICATE",
        revenueHead: "TEST",
        description: "fixture",
        requirements: [],
        certificateType: "CERTIFICATE_OF_ORIGIN",
        isActive: true,
        feeConfig: { create: { amount: 1234, status: "ACTIVE" } },
      },
    });
    const r5 = await hit("GET", `${API}/payments/gpay/virtual-account?serviceId=${fixtureService.id}`);
    check(
      "unmapped service -> 404 VIRTUAL_ACCOUNT_UNAVAILABLE",
      r5.status === 404 && r5.json?.error?.code === "VIRTUAL_ACCOUNT_UNAVAILABLE",
      r5.status + " " + r5.text,
    );

    // ── 5. Invoice route, both mounts ──────────────────────────────
    // Deliberately a DIFFERENT service from the public one above: the
    // matching test below must see exactly one tenement_rate candidate,
    // otherwise a second legitimate pending payment would (correctly) make
    // the settlement "ambiguous" and defeat the attach assertions.
    const svc2 = await p.service.findFirst({ where: { code: "kiosk_licence" } });
    fixtureInvoice = await p.invoice.create({
      data: {
        invoiceNumber: "TEST-VA-" + Date.now(),
        amount: 5000,
        paymentStatus: "pending",
        serviceId: svc2.id,
      },
    });
    const num = fixtureInvoice.invoiceNumber;

    const m1 = await hit("GET", `${API}/invoices/${num}/virtual-account`);
    check("mount A /invoices/... -> 401 without token", m1.status === 401, m1.status);
    const m2 = await hit("GET", `${API}/payments/gpay/invoices/${num}/virtual-account`);
    check("mount B gpay router -> 401 without token", m2.status === 401, m2.status);

    const user = await p.user.findFirst({
      where: { isActive: true, role: { in: ["lga_admin", "super_admin", "treasurer"] } },
    });
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        wardId: user.wardId || null,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );

    const m3 = await hit("GET", `${API}/payments/gpay/invoices/${num}/virtual-account`, { token });
    check("mount B -> 200 with token", m3.status === 200, m3.status + " " + m3.text);
    const m4 = await hit("GET", `${API}/invoices/${num}/virtual-account`, { token });
    check("mount A -> 200 with token (same handler)", m4.status === 200, m4.status + " " + m4.text);
    check("both mounts agree on the reference", m3.json?.data?.reference === m4.json?.data?.reference, m3.json?.data?.reference + " vs " + m4.json?.data?.reference);
    const mkeys = m3.json?.data ? Object.keys(m3.json.data).sort().join(",") : "";
    check(
      "invoice VA adds amount + invoiceNumber",
      mkeys === "accountName,accountNumber,amount,bankName,expectedAmount,invoiceNumber,reference",
      mkeys,
    );

    const reloaded = await p.invoice.findUnique({ where: { id: fixtureInvoice.id } });
    check("first read persisted virtualAccountNumber", reloaded.virtualAccountNumber === "9652745905", reloaded.virtualAccountNumber);
    check("stale Zenith default replaced with Providus", reloaded.virtualBankName === "Providus Bank", reloaded.virtualBankName);

    // PaymentStatus is pending|confirmed|failed|reversed (InvoiceStatus is the
    // one with "paid") — a settled invoice is "confirmed" here.
    const paidInv = await p.invoice.findFirst({ where: { paymentStatus: "confirmed" } });
    if (paidInv) {
      const pd = await hit("GET", `${API}/payments/gpay/invoices/${paidInv.invoiceNumber}/virtual-account`, { token });
      check("already-paid invoice -> 400 BAD_REQUEST", pd.status === 400 && pd.json?.error?.code === "BAD_REQUEST", pd.status + " " + pd.text);
    }

    // ── 6. Webhook: attach, then dedupe on replay ───────────────────
    const stamp = Date.now();
    const paidAtLagos = new Date(Date.now() + 3600 * 1000)
      .toISOString().replace("T", " ").slice(0, 19);
    const payload = {
      event: "charge.success",
      data: {
        gpay_reference: "GPAY_SETTLE_" + stamp,
        merchant_transaction_ref: "PROV_SETTLE_" + stamp,
        providus_settlement_id: "PROV_SETTLE_SID_" + stamp,
        providus_session_id: "PROV_SESS_" + stamp,
        status: "successful",
        account_type: "Reserved Virtual Account",
        service: { service_code: "TENEMENTR", service_name: "Tenement Rate" },
        amount_settled: "25000.00",
        fee: "0.00",
        currency: "NGN",
        account_number: "9653241600",
        paid_at: paidAtLagos,
        payer_details: {
          source_account_number: "0123456789",
          source_account_name: "ADEOLA TEST",
          source_bank_name: "GTBank",
          channel_id: "NIP",
        },
      },
    };
    const raw = JSON.stringify(payload);

    const w1 = await hit("POST", `${API}/payments/gpay/webhook`, { body: raw, sig: hmac(raw, secret) });
    check("VA webhook first delivery -> 200 ack", w1.status === 200, w1.status + " " + w1.text);
    await sleep(3000);

    const matched = await p.payment.findFirst({ where: { gatewayRef: payload.data.gpay_reference } });
    check("credit attached to exactly one pending Payment", !!matched, "no row for " + payload.data.gpay_reference);
    check("matchStatus = matched", matched && matched.matchStatus === "matched", matched && matched.matchStatus);
    check("status STILL pending (never auto-confirmed)", matched && matched.status === "pending", matched && matched.status);
    check("confirmedAt left empty", matched && !matched.confirmedAt, matched && String(matched.confirmedAt));
    check("serviceCode stored as OUR code", matched && matched.serviceCode === "tenement_rate", matched && matched.serviceCode);
    check("payer evidence persisted", matched && matched.payerName === "ADEOLA TEST" && matched.payerBank === "GTBank" && matched.payerAccount === "0123456789", matched && `${matched.payerName}/${matched.payerBank}/${matched.payerAccount}`);
    check("rawPayload captured", matched && !!matched.rawPayload, "null");
    check("settledAt parsed from Lagos time", matched && matched.settledAt && Math.abs(matched.settledAt.getTime() - Date.now()) < 20000, matched && String(matched.settledAt));
    check("attached to the reference we quoted", matched && matched.reference === d?.reference, matched && matched.reference);

    const w2 = await hit("POST", `${API}/payments/gpay/webhook`, { body: raw, sig: hmac(raw, secret) });
    check("replay -> 200 ack", w2.status === 200, w2.status + " " + w2.text);
    await sleep(2000);
    const rows = await p.payment.count({ where: { gatewayRef: payload.data.gpay_reference } });
    check("replay created NO duplicate row", rows === 1, "rows=" + rows);

    const provIntent = await p.paymentIntent.findFirst({ where: { reference: payload.data.merchant_transaction_ref } });
    check("PROV_SETTLE_* never became a PaymentIntent", !provIntent, provIntent && provIntent.reference);
    const intentsAfter = await p.paymentIntent.count();
    check("payment_intents count untouched by VA webhook", intentsAfter === baseIntents, baseIntents + " -> " + intentsAfter);

    // ── 7. No candidate -> stub, nothing changed ────────────────────
    const stubStamp = Date.now();
    const stubPayload = {
      event: "charge.success",
      data: {
        gpay_reference: "GPAY_SETTLE_STUB_" + stubStamp,
        merchant_transaction_ref: "PROV_SETTLE_STUB_" + stubStamp,
        providus_settlement_id: "PROV_SID_STUB_" + stubStamp,
        providus_session_id: "PROV_SESS_STUB_" + stubStamp,
        status: "successful",
        account_type: "Reserved Virtual Account",
        service: { service_code: "TENEMENTR" },
        amount_settled: "77777.00",
        currency: "NGN",
        account_number: "9653241600",
        paid_at: paidAtLagos,
        payer_details: { source_account_name: "UNKNOWN PAYER" },
      },
    };
    const stubRaw = JSON.stringify(stubPayload);
    const w3 = await hit("POST", `${API}/payments/gpay/webhook`, { body: stubRaw, sig: hmac(stubRaw, secret) });
    check("unmatched credit -> 200 ack", w3.status === 200, w3.status + " " + w3.text);
    await sleep(2500);
    const stub = await p.payment.findFirst({ where: { gatewayRef: stubPayload.data.gpay_reference } });
    check("unmatched credit stored as a stub", !!stub, "no stub row");
    check("stub matchStatus = unmatched", stub && stub.matchStatus === "unmatched", stub && stub.matchStatus);
    check("stub status is pending, NOT confirmed", stub && stub.status === "pending", stub && stub.status);

    // ── 8. Signature still enforced ────────────────────────────────
    const bad = await hit("POST", `${API}/payments/gpay/webhook`, { body: stubRaw, sig: "deadbeef" });
    check("bad signature -> 401", bad.status === 401, bad.status);
    await sleep(1500);
    const after = await p.payment.count({ where: { gatewayRef: stubPayload.data.gpay_reference } });
    check("rejected webhook mutated nothing", after === 1, "rows=" + after);

    // ── 9. Existing GPay/Paystack routes unaffected ────────────────
    const ps = await hit("GET", `${API}/payments/verify/NOT-A-REAL-REF`);
    check("Paystack verify still responds (no 500)", ps.status !== 500, ps.status);
    const gw = await hit("GET", `${API}/payments/gpay/verify/PAY-NOT-REAL`);
    check("GPay verify still 404s unknown ref", gw.status === 404, gw.status);

    console.log(`\n  payment_intents: ${baseIntents} -> ${await p.paymentIntent.count()}`);
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  } catch (err) {
    console.error("SUITE ERROR:", err);
    fail++;
  } finally {
    // Remove everything this run created.
    if (fixtureInvoice) {
      await p.invoice.delete({ where: { id: fixtureInvoice.id } }).catch(() => {});
    }
    if (fixtureService) {
      await p.serviceFeeConfig.delete({ where: { serviceId: fixtureService.id } }).catch(() => {});
      await p.service.delete({ where: { id: fixtureService.id } }).catch(() => {});
    }
    const purged = await p.payment.deleteMany({
      where: {
        OR: [
          { serviceCode: "tenement_rate", status: "pending", method: "bank_transfer" },
          { gatewayRef: { startsWith: "GPAY_SETTLE_" } },
        ],
      },
    });
    const left = await p.payment.count();
    const leftIntents = await p.paymentIntent.count();
    console.log(
      `\n  cleanup: purged ${purged.count} test payments | payments ${basePayments} -> ${left} | intents ${baseIntents} -> ${leftIntents}`,
    );
    await p.$disconnect();
  }
})();
