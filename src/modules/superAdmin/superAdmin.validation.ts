// src/modules/superAdmin/superAdmin.validation.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email:     z.string().email(),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  phone:     z.string().min(10).optional(),
  role:      z.enum([
    'super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor',
    'ward_councillor', 'contractor', 'field_officer', 'agent',
    'business_owner', 'citizen',
  ]),
  wardId:       z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  phone:     z.string().min(10).optional(),
  role:      z.enum([
    'super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor',
    'ward_councillor', 'contractor', 'field_officer', 'agent',
    'business_owner', 'citizen',
  ]).optional(),
  wardId:       z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  isActive:     z.boolean().optional(),
});

export const listUsersSchema = z.object({
  page:     z.string().optional().transform((v) => parseInt(v || '1')),
  limit:    z.string().optional().transform((v) => parseInt(v || '20')),
  role:     z.enum([
    'super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor',
    'ward_councillor', 'contractor', 'field_officer', 'agent',
    'business_owner', 'citizen',
  ]).optional(),
  isActive: z.string().optional().transform((v) => v === 'true'),
  search:   z.string().optional(),
});

export const dateRangeSchema = z.object({
  from:  z.string().optional(),
  to:    z.string().optional(),
});