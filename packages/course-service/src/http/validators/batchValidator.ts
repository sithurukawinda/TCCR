import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const scheduleEntrySchema = z.object({
  semesterId: z.string().uuid('semesterId must be a UUID'),
  openDate:   z.string().regex(dateRegex, 'openDate must be YYYY-MM-DD').nullable(),
  endDate:    z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD').nullable(),
});

export const setBatchSemesterDatesSchema = z.object({
  schedule: z.array(scheduleEntrySchema).min(1, 'schedule must contain at least one entry'),
});

export const patchBatchSemesterDateSchema = z.object({
  openDate: z.string().regex(dateRegex, 'openDate must be YYYY-MM-DD').nullable(),
  endDate:  z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD').nullable(),
});

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
