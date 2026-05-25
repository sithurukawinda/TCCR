import { getFirestore }                             from 'firebase-admin/firestore';
import { AnalyticsSnapshot, AnalyticsSnapshotProps } from '../../domain/entities/AnalyticsSnapshot';
import { IAnalyticsRepository }                      from '../../domain/repositories/IAnalyticsRepository';

function toEntity(id: string, data: Omit<AnalyticsSnapshotProps, 'id'>): AnalyticsSnapshot {
  return new AnalyticsSnapshot({ ...data, id });
}

export class FirestoreAnalyticsRepository implements IAnalyticsRepository {
  private readonly col = getFirestore().collection('analytics_snapshots');

  async findByScope(scope: string, from?: string, to?: string, limit = 52): Promise<AnalyticsSnapshot[]> {
    let q: FirebaseFirestore.Query = this.col.where('scope', '==', scope);

    if (from) q = q.where('periodKey', '>=', from);
    if (to)   q = q.where('periodKey', '<=', to);

    q = q.orderBy('periodKey', 'asc').limit(limit);

    const snap  = await q.get();
    return snap.docs.map(d => toEntity(d.id, d.data() as Omit<AnalyticsSnapshotProps, 'id'>));
  }

  async findLatestByScope(scope: string): Promise<AnalyticsSnapshot | null> {
    const snap = await this.col
      .where('scope', '==', scope)
      .orderBy('periodKey', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const d = snap.docs[0];
    return toEntity(d.id, d.data() as Omit<AnalyticsSnapshotProps, 'id'>);
  }
}
