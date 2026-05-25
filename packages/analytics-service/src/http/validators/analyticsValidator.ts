import { z } from 'zod';

export const weeklyCellsSchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});

export const attendanceSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
});

export const growthSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
});

export const exportSchema = z.object({
  from:  z.string().optional(),
  to:    z.string().optional(),
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});
