import { z } from 'zod';

export const createCourseSchema = z.object({
  title:         z.string().min(1).max(200),
  description:   z.string().max(500).optional().default(''),
  coverImageUrl: z.string().url().nullable().optional().default(null),
});

export const updateCourseSchema = z.object({
  title:         z.string().min(1).max(200).optional(),
  description:   z.string().max(500).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});

export const listCoursesSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  state:  z.enum(['draft', 'published', 'archived']).optional(),
  title:  z.string().min(1).max(200).optional(),
});
