// src/modules/stateOfOrigin/stateOfOrigin.validation.ts
import { z } from 'zod';

export const submitApplicationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date of birth',
  }),
  gender: z.enum(['male', 'female', 'other']),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional(),
  wardId: z.string().uuid('Invalid ward ID'),
  purpose: z.string().min(3).optional(),
  nin: z.string().optional(),
  passportUrl: z.string().url().optional(),
});

export const reviewApplicationSchema = z.object({
  reviewNotes: z.string().optional(),
});

export const councillorDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  councillorNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
}).refine((data) => {
  if (data.decision === 'rejected' && !data.rejectionReason) {
    return false;
  }
  return true;
}, { message: 'Rejection reason is required when rejecting an application' });

export const listApplicationsSchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => parseInt(v || '10')),
  status: z.enum([
    'draft', 'submitted', 'payment_pending', 'paid',
    'under_review', 'forwarded_to_councillor',
    'approved', 'rejected', 'certificate_issued'
  ]).optional(),
  wardId: z.string().uuid().optional(),
});