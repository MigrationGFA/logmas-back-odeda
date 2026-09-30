/* eslint-disable */
// In-process probe: calls gpayWebhook directly so console output from the
// handler is visible (the dev server's stdout is not capturable here).
require("dotenv").config();
import crypto from "crypto";
import { gpayWebhook } from "../src/modules/payment/gpay.controller";
import { prisma } from "../src/utils/prisma";

const stamp = Date.now();
const paidAtLagos = new Date(Date.now() + 3600 * 1000)
  .toISOString()
  .replace("T", " ")
  .slice(0, 19);

const payload = {
  event: "charge.success",
  data: {
    gpay_reference: "GPAY_SETTLE_PROBE_" + stamp,
    merchant_transaction_ref: "PROV_SETTLE_PROBE_" + stamp,
    providus_settlement_id: "PROV_SID_PROBE_" + stamp,
    providus_session_id: "PROV_SESS_PROBE_" + stamp,
    status: "successful",
    account_type: "Reserved Virtual Account",
    service: { service_code: "TENEMENTR" },
    amount_settled: "25000.00",
    currency: "NGN",
    account_number: "9653241600",
    paid_at: paidAtLagos,
    payer_details: {
      source_account_name: "PROBE PAYER",
      source_bank_name: "GTBank",
      source_account_number: "0123456789",
    },
  },
};

const raw = Buffer.from(JSON.stringify(payload), "utf8");
const sig = crypto
  .createHmac("sha256", process.env.GPAY_WEBHOOK_SECRET!)
  .update(raw)
  .digest("hex");

const res: any = {
  code: 0,
  status(n: number) {
    this.code = n;
    return this;
  },
  json(body: any) {
    console.log("RES", this.code, JSON.stringify(body));
    return this;
  },
};

(async () => {
  const pending = await prisma.payment.create({
    data: {
      reference: "DIAG-" + Date.now(),
      amount: 25000,
      method: "bank_transfer",
      status: "pending",
      serviceCode: "tenement_rate",
    },
  });
  console.log("created pending:", pending.reference, pending.createdAt.toISOString());
  console.log("paid_at sent =", paidAtLagos, "-> parsed UTC =",
    new Date(Date.parse(paidAtLagos.replace(" ", "T") + "Z") - 3600 * 1000).toISOString());

  const rows = await prisma.payment.findMany({
    where: {
      status: "pending",
      method: { in: ["bank_transfer", "virtual_account"] },
      createdAt: { gte: new Date(Date.now() - 72 * 3600 * 1000), lte: new Date() },
      OR: [
        { serviceCode: "tenement_rate" },
        { invoice: { is: { service: { code: "tenement_rate" } } } },
      ],
    },
    select: { reference: true, amount: true, serviceCode: true, method: true, status: true },
  });
  console.log("candidate rows =", JSON.stringify(rows));

  // Realistic ordering: the citizen already has their reference BEFORE the
  // bank settles, so the settlement timestamp comes after the row was created.
  // GPay reports Lagos time (UTC+1), hence the extra hour.
  payload.data.paid_at = new Date(Date.now() + 2000 + 3600 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const raw2 = Buffer.from(JSON.stringify(payload), "utf8");
  const sig2 = crypto
    .createHmac("sha256", process.env.GPAY_WEBHOOK_SECRET!)
    .update(raw2)
    .digest("hex");
  console.log("re-signed paid_at =", payload.data.paid_at);

  console.log("gpay_reference =", payload.data.gpay_reference);
  await gpayWebhook({ headers: { "x-gpay-signature": sig2 }, body: raw2 } as any, res);

  const row = await prisma.payment.findFirst({
    where: { gatewayRef: payload.data.gpay_reference },
  });
  console.log("row written:", row ? JSON.stringify({
    reference: row.reference,
    status: row.status,
    matchStatus: row.matchStatus,
    serviceCode: row.serviceCode,
  }) : "NONE");

  if (row) {
    await prisma.payment.delete({ where: { id: row.id } });
    console.log("cleaned probe row");
  }
  await prisma.$disconnect();
})();
