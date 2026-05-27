import { z } from 'zod';

export const CELL_TYPES = ['care', 'children', 'outreach', 'g12'] as const;

/** Shared filter params accepted by every analytics endpoint */
const filterFields = {
  g12Uid:   z.string().optional(),
  leaderUid: z.string().optional(),
  cellType:  z.enum(CELL_TYPES).optional(),
};

export const weeklyCellsSchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
  ...filterFields,
});

export const attendanceSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
  ...filterFields,
});

export const meetingTypesSchema = z.object({
  ...filterFields,
});

export const growthSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
  ...filterFields,
});

export const participationSchema = z.object({
  ...filterFields,
});

export const exportSchema = z.object({
  from:  z.string().optional(),
  to:    z.string().optional(),
  weeks: z.coerce.number().int().min(1).max(52).default(12),
  ...filterFields,
});
