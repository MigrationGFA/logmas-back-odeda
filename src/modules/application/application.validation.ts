import { z } from 'zod';

export const createApplicationSchema = z.object({
  serviceId: z.string().uuid(),
  fullName: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  address: z.string().min(1),
  ward: z.string().optional(),
  nin: z.string().optional(),
  cacNumber: z.string().optional(),
 formData: z.record(z.string(), z.any()),
});

export const listApplicationsQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
