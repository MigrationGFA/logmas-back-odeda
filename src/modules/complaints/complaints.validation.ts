// src/modules/complaints/complaints.validation.ts
import { z } from 'zod';

export const raiseComplaintSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Please provide more detail in your description'),
  wardId: z.string().uuid('Invalid ward ID'),
});

export const assignComplaintSchema = z.object({
  assignedToId: z.string().uuid('Invalid officer ID'),
  wardId: z.string().uuid('Invalid ward ID'),
});

export const respondToComplaintSchema = z.object({
  message: z.string().min(5, 'Response message is required'),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(['assigned', 'in_progress', 'resolved', 'closed']),
  resolutionNote: z.string().optional(),
}).refine((data) => {
  if (data.status === 'resolved' && !data.resolutionNote) return false;
  return true;
}, { message: 'Resolution note is required when marking as resolved' });

export const listComplaintsSchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => parseInt(v || '10')),
  status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  wardId: z.string().uuid().optional(),
});