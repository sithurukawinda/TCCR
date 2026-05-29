import { z } from 'zod';

export const subjectAccessSchema = z.object({
  courseId:   z.string().min(1),
  semesterId: z.string().min(1),
});

export const subjectCompleteSchema = z.object({
  courseId:   z.string().min(1),
  semesterId: z.string().min(1),
});

export const resetProgressSchema = z.object({
  studentUid: z.string().min(1),
  courseId:   z.string().min(1),
});

export const lessonCompleteSchema = z.object({
  courseId:   z.string().min(1),
  subjectId:  z.string().min(1),
  semesterId: z.string().min(1),
  batchId:    z.string().min(1).optional(),
});

export const saveVideoPositionSchema = z.object({
  watchedSeconds: z.number().int().min(0),
  courseId:       z.string().uuid(),
});
