import { IAuditRepository } from '../../domain/repositories/IAuditRepository';

export interface AuditEventPayload {
  actorUid?:    string | null;
  actorEmail?:  string | null;
  action:       string;
  category?:    string | null;
  ip?:          string | null;
  targetType?:  string | null;
  targetId?:    string | null;
  [key: string]: unknown;
}

type P = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

interface EventMeta {
  category:      string;
  targetType:    string;
  getActorUid:   (p: P) => string | null;
  getActorEmail: (p: P) => string | null;
  getTargetId:   (p: P) => string | null;
}

const EVENT_META: Record<string, EventMeta> = {
  'user.registered': {
    category: 'auth',     targetType: 'user',
    getActorUid:   p => str(p.uid),
    getActorEmail: p => str(p.email),
    getTargetId:   p => str(p.uid),
  },
  'admin.created': {
    category: 'admin',    targetType: 'user',
    getActorUid:   p => str(p.uid),
    getActorEmail: p => str(p.email),
    getTargetId:   p => str(p.uid),
  },
  'admin.suspended': {
    category: 'admin',    targetType: 'user',
    getActorUid:   p => str(p.uid),
    getActorEmail: p => str(p.email),
    getTargetId:   p => str(p.uid),
  },
  'registration.approved': {
    category: 'registration', targetType: 'registration',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: p => str(p.email),
    getTargetId:   p => str(p.studentUid),
  },
  'registration.rejected': {
    category: 'registration', targetType: 'registration',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: p => str(p.email),
    getTargetId:   p => str(p.studentUid),
  },
  'enrollment.pending': {
    category: 'enrollment', targetType: 'enrollment',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: _p => null,
    getTargetId:   p => { const u = str(p.studentUid); const c = str(p.courseId); return u && c ? `${u}_${c}` : u; },
  },
  'enrollment.approved': {
    category: 'enrollment', targetType: 'enrollment',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: _p => null,
    getTargetId:   p => { const u = str(p.studentUid); const c = str(p.courseId); return u && c ? `${u}_${c}` : u; },
  },
  'enrollment.rejected': {
    category: 'enrollment', targetType: 'enrollment',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: _p => null,
    getTargetId:   p => { const u = str(p.studentUid); const c = str(p.courseId); return u && c ? `${u}_${c}` : u; },
  },
  'enrollment.withdrawn': {
    category: 'enrollment', targetType: 'enrollment',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: _p => null,
    getTargetId:   p => { const u = str(p.studentUid); const c = str(p.courseId); return u && c ? `${u}_${c}` : u; },
  },
  'course.published': {
    category: 'course',   targetType: 'course',
    getActorUid:   _p => null,
    getActorEmail: _p => null,
    getTargetId:   p => str(p.courseId),
  },
  'progress.subjectCompleted': {
    category: 'progress', targetType: 'subject',
    getActorUid:   p => str(p.studentUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.subjectId),
  },
  'cell.created': {
    category: 'cell',     targetType: 'cell_group',
    getActorUid:   p => str(p.leaderUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.cellId),
  },
  'cell.join_requested': {
    category: 'cell',     targetType: 'join_request',
    getActorUid:   p => str(p.requesterUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.joinRequestId),
  },
  'cell.join_approved': {
    category: 'cell',     targetType: 'join_request',
    getActorUid:   p => str(p.decidedByUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.joinRequestId),
  },
  'cell.join_rejected': {
    category: 'cell',     targetType: 'join_request',
    getActorUid:   p => str(p.decidedByUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.joinRequestId),
  },
  'cell_report.filed': {
    category: 'cell',     targetType: 'cell_report',
    getActorUid:   p => str(p.filledByUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.reportId),
  },
  'cell_report.voided': {
    category: 'cell',     targetType: 'cell_report',
    getActorUid:   p => str(p.voidedByUid),
    getActorEmail: _p => null,
    getTargetId:   p => str(p.reportId),
  },
};

export class AuditEventHandler {
  constructor(private readonly auditRepo: IAuditRepository) {}

  async handle(payload: AuditEventPayload, requestId: string): Promise<void> {
    const p = payload as P;
    const meta = EVENT_META[payload.action];

    await this.auditRepo.append({
      actorUid:   payload.actorUid   ?? meta?.getActorUid(p)   ?? null,
      actorEmail: payload.actorEmail ?? meta?.getActorEmail(p)  ?? null,
      action:     payload.action,
      category:   payload.category   ?? meta?.category          ?? null,
      ip:         payload.ip         ?? null,
      targetType: payload.targetType ?? meta?.targetType        ?? null,
      targetId:   payload.targetId   ?? meta?.getTargetId(p)   ?? null,
      payload,
      requestId,
      createdAt:  new Date().toISOString(),
    });
  }
}
