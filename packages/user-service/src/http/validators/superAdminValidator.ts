import { z } from 'zod';

const passwordRule = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .regex(/[A-Z]/,        'Password must contain an uppercase letter.')
  .regex(/[a-z]/,        'Password must contain a lowercase letter.')
  .regex(/[0-9]/,        'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.');

export const createAdminSchema = z.object({
  firstName:       z.string().min(1).max(100),
  lastName:        z.string().min(1).max(100),
  email:           z.string().email(),
  initialPassword: passwordRule,
});

export const listAdminsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
