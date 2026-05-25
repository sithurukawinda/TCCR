import { z } from 'zod';

export const auditQuerySchema = z.object({
  actorUid:   z.string().optional(),
  action:     z.string().optional(),
  category:   z.string().optional(),
  targetType: z.string().optional(),
  targetId:   z.string().optional(),
  from:       z.string().optional(),
  to:         z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  cursor:     z.string().optional(),
});

// Per-user timeline — actorUid comes from URL :uid, not query string
export const userAuditQuerySchema = z.object({
  action:     z.string().optional(),
  category:   z.string().optional(),
  targetType: z.string().optional(),
  targetId:   z.string().optional(),
  from:       z.string().optional(),
  to:         z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  cursor:     z.string().optional(),
});

export const internalEventSchema = z.object({
  eventType: z.string().min(1),
  payload:   z.record(z.unknown()),
  requestId: z.string(),
});
