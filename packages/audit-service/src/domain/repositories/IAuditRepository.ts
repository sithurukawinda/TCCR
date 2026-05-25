export interface AuditLogEntry {
  actorUid:    string | null;
  actorEmail:  string | null;
  action:      string;
  category:    string | null;
  ip:          string | null;
  targetType:  string | null;
  targetId:    string | null;
  payload:     unknown;
  requestId:   string;
  createdAt:   string;
}

export interface AuditLogDTO {
  id:         string;
  when:       string;
  actor:      { uid: string | null; email: string | null };
  action:     string;
  category:   string | null;
  ip:         string | null;
  targetType: string | null;
  targetId:   string | null;
  requestId:  string;
}

export interface AuditQueryOptions {
  actorUid?:   string;
  action?:     string;
  category?:   string;
  targetType?: string;
  targetId?:   string;
  from?:       string;
  to?:         string;
  limit:       number;
  cursor?:     string;
}

export interface AuditListResult {
  items:      Array<AuditLogEntry & { id: string }>;
  nextCursor: string | null;
  total:      number;
}

export interface IAuditRepository {
  append(entry: AuditLogEntry): Promise<string>;
  findAll(opts: AuditQueryOptions): Promise<AuditListResult>;
}
