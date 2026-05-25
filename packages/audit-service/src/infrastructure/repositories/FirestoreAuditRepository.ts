import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { IAuditRepository, AuditLogEntry, AuditQueryOptions, AuditListResult } from '../../domain/repositories/IAuditRepository';

export class FirestoreAuditRepository implements IAuditRepository {
  private readonly col = getFirestore().collection('audit_log');

  async append(entry: AuditLogEntry): Promise<string> {
    const ref = await this.col.add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async findAll(opts: AuditQueryOptions): Promise<AuditListResult> {
    let q = this.col as FirebaseFirestore.Query;

    if (opts.actorUid)   q = q.where('actorUid',   '==', opts.actorUid);
    if (opts.action)     q = q.where('action',     '==', opts.action);
    if (opts.category)   q = q.where('category',   '==', opts.category);
    if (opts.targetType) q = q.where('targetType', '==', opts.targetType);
    if (opts.targetId)   q = q.where('targetId',   '==', opts.targetId);
    if (opts.from)       q = q.where('createdAt',  '>=', opts.from);
    if (opts.to)         q = q.where('createdAt',  '<=', opts.to);

    const total = (await q.count().get()).data().count;

    q = q.orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }

    const snap  = await q.get();
    const items = snap.docs.map(d => {
      const data = d.data();
      const raw  = data.createdAt as FirebaseFirestore.Timestamp | string | null;
      const createdAt = raw && typeof (raw as FirebaseFirestore.Timestamp).toDate === 'function'
        ? (raw as FirebaseFirestore.Timestamp).toDate().toISOString()
        : String(raw ?? '');
      return { id: d.id, ...(data as Omit<AuditLogEntry, 'createdAt'>), createdAt };
    });
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }
}
