import { z } from 'zod';

export const createSemesterSchema = z.object({
  title:    z.string().min(1).max(200),
  openDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'openDate must be ISO date YYYY-MM-DD').nullable().optional().default(null),
  endDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be ISO date YYYY-MM-DD').nullable().optional().default(null),
}).refine(d => !d.openDate || !d.endDate || d.endDate >= d.openDate, {
  message: 'endDate must be on or after openDate',
  path:    ['endDate'],
});

export const updateSemesterSchema = z.object({
  title:    z.string().min(1).max(200).optional(),
  openDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
