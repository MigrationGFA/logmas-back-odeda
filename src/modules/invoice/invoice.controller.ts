
import { InvoiceStatus, Role, Prisma, PaymentMethod } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendError, sendSuccess } from '../../utils/response';
import { generateQrToken, generateReceiptNumber, generateReference, generateVerificationCode } from '../../utils/generators';
import { getIp } from '../complaints/complaints.controller';

interface GetInvoicesQuery {
  role: Role;
  userId: string;
  tab?: string;
  search?: string;
}

export const fetchInvoicesHubData = async ({ role, userId, tab, search }: GetInvoicesQuery) => {
  // 1. Build Base Context Filters based on Role access criteria
  const baseWhere: Prisma.InvoiceWhereInput = {};

  if (role === Role.citizen || role === Role.business_owner) {
    baseWhere.OR = [
      { createdById: userId },
      { business: { ownerId: userId } }
    ];
  } else if (role === Role.field_officer) {
    baseWhere.createdById = userId;
  } else if (role === Role.contractor) {
    baseWhere.createdBy = { contractorId: userId };
  } else if (role === Role.ward_councillor) {
    const councillor = await prisma.user.findUnique({ where: { id: userId }, select: { wardId: true } });
    if (councillor?.wardId) {
      baseWhere.business = { wardId: councillor.wardId };
    }
  }

  // 2. Fetch Aggregates for the 4 Stat Cards (Unfiltered by search or tab)
// Ensure your aggregate card states exclude paid/cancelled options safely
const [totalsAggregate, paidReceiptsCount] = await Promise.all([
  prisma.invoice.aggregate({
    where: {
      ...baseWhere,
      // Outstanding balance means it's not paid and not cancelled/draft
      status: {
        in: [InvoiceStatus.sent, InvoiceStatus.overdue, InvoiceStatus.partially_paid]
      }
    },
    _sum: {
      totalAmount: true,
      amountPaid: true,
      balanceDue: true, // Your schema tracks this cleanly!
    },
    _count: { id: true }
  }),
  
  prisma.receipt.count({
    where: { invoice: baseWhere }
  })
]);

  const totalCollected = Number(totalsAggregate._sum.amountPaid || 0);
  const outstandingAmount = Number(totalsAggregate._sum.balanceDue || 0);
  const avgPayment = paidReceiptsCount > 0 ? Math.round(totalCollected / paidReceiptsCount) : 0;

  // 3. Inject Search and Tab Filter Criteria for the main table ledger
  const listWhere: Prisma.InvoiceWhereInput = { ...baseWhere };

  if (tab && tab !== 'all') {
  if (tab === 'unpaid') {
    // If the user selects the "Unpaid" tab, check for statuses representing money owed
    listWhere.status = {
      in: [InvoiceStatus.sent, InvoiceStatus.partially_paid]
    };
  } else {
    // Otherwise map directly to standard enums like paid, overdue, draft, cancelled
    listWhere.status = tab as InvoiceStatus;
  }
}
 if (search) {
  listWhere.AND = [
    { OR: baseWhere.OR ? baseWhere.OR : [] },   // keep ownership filter
    {
      OR: [
        { invoiceNumber:  { contains: search, mode: 'insensitive' } },
        { description:    { contains: search, mode: 'insensitive' } },
        { business: { businessName: { contains: search, mode: 'insensitive' } } },
        { createdBy: { firstName:   { contains: search, mode: 'insensitive' } } },
        { createdBy: { lastName:    { contains: search, mode: 'insensitive' } } },
      ],
    },
  ];
  delete listWhere.OR; // remove the top-level OR to avoid conflict
}
  // 4. Fetch Ledger Data rows including immediate nested receipt references
const invoices = await prisma.invoice.findMany({
  where: listWhere,
  include: {
    receipt: {
      select: { id: true, receiptNumber: true }
    },
    business: {
      select: { businessName: true, category: true }
    },
    createdBy: {                          // ← add this
      select: { firstName: true, lastName: true }
    },
  },
  orderBy: { createdAt: 'desc' }
});

  // 5. Map rows to align explicitly with frontend data names
  const formattedInvoices = invoices.map((inv) => ({
  id:           inv.id,
  reference:    inv.invoiceNumber,
  customerName: inv.business?.businessName
    ?? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
  levyType:  inv.category,
  dueDate:   inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : 'N/A',
  amount:    Number(inv.totalAmount),
  status:    inv.status,
  receiptId: inv.receipt?.id || null,
}));

  return {
    stats: {
      outstanding: outstandingAmount,
      totalCollected: totalCollected,
      transactions: paidReceiptsCount,
      avgPayment: avgPayment
    },
    invoices: formattedInvoices
  };
};


/**
 * @desc    Get Invoices Ledger List and Stats Overview in a single batch query
 * @route   GET /api/v1/invoices/hub
 * @access  Authenticated
 */
export const getInvoicesHubOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: userId, role } = (req as any).user as { id: string; role: Role };
    const { tab, search } = req.query as { tab?: string; search?: string };

    const payload = await fetchInvoicesHubData({
      role,
      userId,
      tab,
      search
    });

    res.status(200).json({
      success: true,
      ...payload
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/invoices/:id
export const getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user!;

    const invoice = await prisma.invoice.findUnique({
      where: { id:String(id) },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true },
        },
        business: {
          select: { id: true, businessName: true, ownerName: true, phone: true, category: true },
        },
        levyConfig: {
          select: { name: true, billingCycle: true, amount: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        receipt: {
          select: { id: true, receiptNumber: true, verificationCode: true, qrToken: true, issuedAt: true },
        },
        permit: {
          select: { id: true, permitNumber: true, status: true },
        },
      },
    });

    if (!invoice) return sendError(res, 'Invoice not found', 'NOT_FOUND', null, 404);

    // Ownership check — citizen/business_owner can only see their own
    const publicRoles = ['citizen', 'business_owner'];
    if (publicRoles.includes(role)) {
    //   const isOwner =
    //     invoice.createdById === userId ||
    //     invoice.business?.ownerId === userId; // ownerId not in select — check separately
      
      // Re-query ownership check cleanly
      const owned = await prisma.invoice.findFirst({
        where: {
          id: String(id),
          OR: [
            { createdById: userId },
            { business: { ownerId: userId } },
          ],
        },
        select: { id: true },
      });

      if (!owned) return sendError(res, 'Invoice not found', 'NOT_FOUND', null, 404);
    }

    // Resolve customer name
    const customerName = invoice.business?.businessName
      ?? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`;

    const customerPhone = invoice.business?.phone
      ?? invoice.createdBy.phone
      ?? null;

    // Shape response to match UI fields exactly
    return sendSuccess(res, {
      id:            invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status:        invoice.status,
      issuedAt:      invoice.createdAt,
      dueDate:       invoice.dueDate,
      paidAt:        invoice.paidAt,

      // Amounts
      totalAmount:   Number(invoice.totalAmount),
      amountPaid:    Number(invoice.amountPaid),
      balanceDue:    Number(invoice.balanceDue),
      subtotal:      Number(invoice.subtotal),
      penaltyAmount: Number(invoice.penaltyAmount),

      // Customer
      customerName,
      customerPhone,

      // Levy details
      levyType:      invoice.category,
      description:   invoice.description,
      frequency:     invoice.levyConfig?.billingCycle ?? 'one_time',
      unitPrice:     Number(invoice.levyConfig?.amount ?? invoice.subtotal),
      quantity:      invoice.subtotal && invoice.levyConfig?.amount
        ? Math.round(Number(invoice.subtotal) / Number(invoice.levyConfig.amount))
        : 1,

      // Officer
      fieldOfficer: invoice.assignedOfficer
        ? `${invoice.assignedOfficer.firstName} ${invoice.assignedOfficer.lastName}`
        : null,

      // QR — use invoice number as the scannable payload until receipt exists
      qrData: invoice.receipt?.verificationCode ?? invoice.invoiceNumber,

      // Receipt (null until paid)
      receipt: invoice.receipt ?? null,

      // Permit (null if not a permit invoice)
      permit: invoice.permit ?? null,

      // Virtual account — stubbed, Phase 7 will populate these from gateway
      virtualAccount: invoice.virtualAccountNo ? {
        accountNumber: invoice.virtualAccountNo,
        bankName:      invoice.virtualAccountBank,
        accountName:   'LOGMAS Collection',
        reference:     invoice.virtualAccountRef,
        // TODO Phase 7: wire Paystack/Flutterwave virtual account generation here
      } : null,

      // Payment history
      payments: invoice.payments.map((p) => ({
        id:          p.id,
        amount:      Number(p.amount),
        method:      p.method,
        status:      p.status,
        reference:   p.reference,
        confirmedAt: p.confirmedAt,
        createdAt:   p.createdAt,
      })),

      // Payment options available — static for now, dynamic in Phase 7
      paymentOptions: ['bank_transfer', 'online', 'pos', 'cash'],
    });
  } catch (err) { next(err); }
};

// POST /api/v1/invoices/:id/pay
export const recordInvoicePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role   = req.user!.role;
    const { method, amount, reference, narration } = req.body;

    const invoice = await prisma.invoice.findUnique({ where: { id:String(id) } });
    if (!invoice) return sendError(res, 'Invoice not found', 'NOT_FOUND', null, 404);

    if (['paid', 'cancelled'].includes(invoice.status)) {
      return sendError(res, 'Invoice is already paid or cancelled', 'BAD_REQUEST', null, 400);
    }

    // ── ONLINE / VIRTUAL ACCOUNT ────────────────────────────
    if (method === 'online' || method === 'virtual_account' || method === 'bank_transfer') {
      // TODO Phase 7: Initialize Paystack/Flutterwave payment here
      // const gatewayResponse = await paystackService.initializeTransaction({
      //   amount: Number(invoice.balanceDue) * 100, // kobo
      //   email: req.user.email,
      //   reference: generateReference('PAY'),
      //   metadata: { invoiceId: id, userId },
      // });
      // return sendSuccess(res, {
      //   paymentUrl: gatewayResponse.data.authorization_url,
      //   reference:  gatewayResponse.data.reference,
      //   message:    'Redirect user to paymentUrl to complete payment',
      // });

      // For now return a stub so the UI doesn't break
      return sendSuccess(res, {
        stub: true,
        message: 'Online payment gateway not yet configured. Coming in Phase 7.',
        paymentUrl: null,
        // Simulate for dev — remove in production
        simulateEndpoint: `/api/v1/invoices/${id}/simulate-payment`,
      });
    }

    // ── CASH / POS ───────────────────────────────────────────
    // Only field officers can record cash/POS
    if (!['field_officer', 'lga_admin', 'super_admin'].includes(role)) {
      return sendError(
        res,
        'Only field officers can record cash or POS payments',
        'FORBIDDEN',
        null,
        403
      );
    }

    const paymentAmount = Number(amount ?? invoice.balanceDue);
    const balanceDue    = Number(invoice.balanceDue);
    const isFullPayment = paymentAmount >= balanceDue;
    const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
    const newBalanceDue = balanceDue - paymentAmount;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId:     String(id),
          amount:        paymentAmount,
          method:        method as PaymentMethod,
          status:        'confirmed',
          reference:     reference || generateReference('PAY'),
          narration,
          confirmedAt:   new Date(),
          confirmedById: userId,
          paidById:      invoice.createdById,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id:String(id) },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status:     isFullPayment ? 'paid' : 'partially_paid',
          paidAt:     isFullPayment ? new Date() : null,
        },
      });

      let receipt = null;
      if (isFullPayment) {
        receipt = await tx.receipt.create({
          data: {
            receiptNumber:    generateReceiptNumber('RCP'),
            verificationCode: generateVerificationCode(),
            qrToken:          generateQrToken(),
            amountPaid:       newAmountPaid,
            invoiceId:        String(id),
            issuedById:       userId,
          },
        });
      }

      return { payment, invoice: updatedInvoice, receipt };
    });

    await prisma.auditLog.create({
      data: {
        action:   'payment_confirmed',
        entity:   'Payment',
        entityId: result.payment.id,
        userId,
        details:  { invoiceId: id, amount: paymentAmount, method, isFullPayment },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, {
      payment: result.payment,
      invoice: result.invoice,
      receipt: result.receipt,
      isFullPayment,
      message: isFullPayment
        ? 'Payment confirmed. Receipt generated.'
        : `Partial payment recorded. Balance due: ₦${newBalanceDue}`,
    }, isFullPayment ? 'Payment complete' : 'Partial payment recorded');
  } catch (err) { next(err); }
};

// ── DEV ONLY — Simulate payment confirmation ─────────────────
// TODO Phase 7: Remove this and replace with real webhook
export const simulatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id:String(id) } });
    if (!invoice) return sendError(res, 'Invoice not found', 'NOT_FOUND', null, 404);
    if (invoice.status === 'paid') {
      return sendError(res, 'Invoice already paid', 'BAD_REQUEST', null, 400);
    }

    const userId = req.user!.id;
    const total  = Number(invoice.totalAmount);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId:  String(id),
          amount:     total,
          method:     'bank_transfer',
          status:     'confirmed',
          reference:  generateReference('SIM'),
          narration:  'Simulated transfer',
          confirmedAt: new Date(),
          paidById:   invoice.createdById,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id:String(id) },
        data: { amountPaid: total, balanceDue: 0, status: 'paid', paidAt: new Date() },
      });

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber:    generateReceiptNumber('RCP'),
          verificationCode: generateVerificationCode(),
          qrToken:          generateQrToken(),
          amountPaid:       total,
          invoiceId:        String(id),
          issuedById:       userId,
        },
      });

      return { payment, invoice: updatedInvoice, receipt };
    });

    return sendSuccess(res, result, 'Payment simulated successfully');
  } catch (err) { next(err); }
};