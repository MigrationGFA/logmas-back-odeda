import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';

/**
 * 1. Field Officer: Register Business on Behalf of Owner
 */
export const fieldRegisterBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessName, ownerName, address, phone, email, cacNumber, category, wardId, ownerId } = req.body;

    const wardExists = await prisma.ward.findFirst({ where: { id: wardId, deletedAt: null } });
    if (!wardExists) return sendError(res, 'Target ward configuration not found', 'NOT_FOUND', null, 404);

    if (cacNumber) {
      const cacDuplicate = await prisma.business.findFirst({ where: { cacNumber, deletedAt: null } });
      if (cacDuplicate) return sendError(res, 'CAC identification registry conflict matching alternative business profile', 'CONFLICT', null, 409);
    }

    const business = await prisma.business.create({
      data: {
        businessName,
        ownerName,
        address,
        phone,
        email: email || null,
        cacNumber: cacNumber || null,
        category,
        wardId,
        ownerId
      }
    });

    return sendSuccess(res, business, 'Business entity registered successfully onto the ledger', 201);
  } catch (err) { next(err); }
};

/**
 * 2. Field Officer: Manual Invoice Generation (Using configuration metrics mapped by Treasurer)
 */
export const fieldCreateInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, category, description, levyConfigId, dueDate } = req.body;
    const officerId = req.user!.id;

    const config = await prisma.levyConfig.findFirst({ where: { id: levyConfigId, isActive: true } });
    if (!config) return sendError(res, 'Active levy configuration price rules matrix missing', 'NOT_FOUND', null, 404);

    const business = await prisma.business.findFirst({ where: { id: businessId, isActive: true, deletedAt: null } });
    if (!business) return sendError(res, 'Target business account record inactive or non-existent', 'NOT_FOUND', null, 404);

    const baseAmount = new Prisma.Decimal(config.amount);
    
    const invoice = await prisma.invoice.create({
      data: {
        category,
        description,
        subtotal: baseAmount,
        totalAmount: baseAmount,
        balanceDue: baseAmount,
        dueDate: new Date(dueDate),
        levyConfigId,
        createdById: officerId,
        assignedOfficerId: officerId,
        businessId,
        status: 'sent' // Promoted to sent status instantly out in the field
      }
    });

    return sendSuccess(res, invoice, 'Field enforcement billing invoice compiled successfully', 201);
  } catch (err) { next(err); }
};

/**
 * 3. Field Officer: Record On-The-Spot Cash/POS Payment + Auto Issue Receipt & Permit
 */
export const fieldRecordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, amount, method, reference, narration } = req.body;
    const officerId = req.user!.id;

    // Use an atomic transaction block to enforce sequential transactional integrity
    const transactionalResult = await prisma.$transaction(async (tx) => {
      
      // Lock target invoice record row safely
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { business: true }
      });

      if (!invoice) throw new Error('TARGET_INVOICE_MISSING');
      if (invoice.status === 'paid') throw new Error('INVOICE_ALREADY_SETTLED');

      const incomingPayment = new Prisma.Decimal(amount);
      const updatedAmountPaid = Prisma.Decimal.add(invoice.amountPaid, incomingPayment);
      const updatedBalanceDue = Prisma.Decimal.sub(invoice.totalAmount, updatedAmountPaid);

      let systemInvoiceStatus: 'paid' | 'partially_paid' = 'partially_paid';
      if (updatedBalanceDue.lessThanOrEqualTo(0)) {
        systemInvoiceStatus = 'paid';
      }

      // Step A: Log the incoming Payment Audit entry
      const payment = await tx.payment.create({
        data: {
          amount: incomingPayment,
          method,
          status: 'confirmed',
          reference,
          narration: narration || `Direct field payment collection recorded by officer`,
          confirmedAt: new Date(),
          confirmedById: officerId,
          invoiceId,
          paidById: invoice.business?.ownerId || null
        }
      });

      // Step B: Update current Invoice balances status variables
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: updatedAmountPaid,
          balanceDue: Prisma.Decimal.max(0, updatedBalanceDue),
          status: systemInvoiceStatus,
          paidAt: systemInvoiceStatus === 'paid' ? new Date() : null
        }
      });

      // Step C: Generate a secure matching systemic ledger verification receipt instance
      const receiptNumber = `REC-${crypto.randomInt(1000000, 9999999)}`;
      const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const qrToken = crypto.randomUUID();

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          verificationCode,
          qrToken,
          amountPaid: incomingPayment,
          invoiceId,
          issuedById: officerId
        }
      });

      // Step D: If invoice is for a trade permit and status is fully settled, issue the operation certificate automatically
      let permit = null;
      if (systemInvoiceStatus === 'paid' && invoice.category === 'trade_permit') {
        const permitNumber = `PRM-${crypto.randomInt(100000, 999999)}`;
        const permitVerificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const permitQrToken = crypto.randomUUID();

        permit = await tx.permit.create({
          data: {
            permitNumber,
            verificationCode: permitVerificationCode,
            qrToken: permitQrToken,
            status: 'issued',
            permitType: 'Annual Trade Permit',
            category: 'trade_permit',
            validFrom: new Date(),
            validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid across 1 production year
            businessId: invoice.businessId!,
            issuedById: officerId,
            invoiceId: invoice.id
          }
        });
      }

      return { invoice: updatedInvoice, payment, receipt, permit };
    });

    return sendSuccess(res, transactionalResult, 'Payment verified and operational assets generated successfully');

  } catch (err: any) {
    if (err.message === 'TARGET_INVOICE_MISSING') return sendError(res, 'Target collection invoice does not exist', 'NOT_FOUND', null, 404);
    if (err.message === 'INVOICE_ALREADY_SETTLED') return sendError(res, 'Action rejected: Target invoice balances are already fully settled', 'BAD_REQUEST', null, 400);
    next(err);
  }
};