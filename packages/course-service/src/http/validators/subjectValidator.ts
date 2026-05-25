import { z } from 'zod';

export const createSubjectSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateSubjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
