import { z } from 'zod';

export const createApplicationSchema = z.object({
  serviceId: z.string().uuid(),
  applicantId: z.string().uuid().optional(),
  formData: z.record(z.string(), z.any()),
});

export const listApplicationsQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
