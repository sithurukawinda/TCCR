export interface DomainEvent<T = Record<string, unknown>> {
  id:         string; // UUID v4 — for deduplication
  type:       string; // e.g. 'registration.approved'
  occurredAt: string; // ISO 8601
  requestId:  string; // X-Request-Id correlation
  payload:    T;
}

export interface OutboxEntry {
  id:          string;
  eventType:   string;
  payload:     unknown;
  requestId:   string;
  status:      'pending' | 'processing' | 'delivered' | 'failed';
  attempts:    number;
  createdAt:   string;
  processedAt: string | null;
  error:       string | null;
}
