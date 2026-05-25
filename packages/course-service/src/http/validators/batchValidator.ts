import { z } from 'zod';

export const createBatchSchema = z.object({
  name:            z.string().min(1).max(200),
  scheduledOpenAt: z.string().datetime({ offset: true }).nullable().optional().default(null),
  intakeStart:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'intakeStart must be ISO date YYYY-MM-DD'),
  intakeEnd:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'intakeEnd must be ISO date YYYY-MM-DD'),
  capacity:        z.number().int().min(1).nullable().optional().default(null),
}).refine(d => d.intakeEnd >= d.intakeStart, {
  message: 'intakeEnd must be on or after intakeStart',
  path:    ['intakeEnd'],
});

export const updateBatchSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  scheduledOpenAt: z.string().datetime({ offset: true }).nullable().optional(),
  intakeStart:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  intakeEnd:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  capacity:        z.number().int().min(1).nullable().optional(),
});
