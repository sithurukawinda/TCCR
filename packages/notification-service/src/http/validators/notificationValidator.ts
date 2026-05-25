import { z } from 'zod';

export const listNotificationsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  read:   z.enum(['true', 'false']).optional().transform(v => v === undefined ? undefined : v === 'true'),
});

export const internalEventSchema = z.object({
  eventType:  z.string().min(1),
  payload:    z.record(z.unknown()),
  requestId:  z.string(),
});
