import { getFirestore }                   from 'firebase-admin/firestore';
import { JoinRequest, JoinRequestProps }  from '../../domain/entities/JoinRequest';
import { IJoinRequestRepository,
         JoinRequestListOptions,
         JoinRequestListResult }          from '../../domain/repositories/IJoinRequestRepository';

function toEntity(id: string, data: Omit<JoinRequestProps, 'id'>): JoinRequest {
  return new JoinRequest({ ...data, id });
}

export class FirestoreJoinRequestRepository implements IJoinRequestRepository {
  private col(cellId: string) {
    return getFirestore().collection('cell_groups').doc(cellId).collection('join_requests');
  }

  async findById(cellId: string, id: string): Promise<JoinRequest | null> {
    const snap = await this.col(cellId).doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as Omit<JoinRequestProps, 'id'>);
  }

  async findPendingByRequester(cellId: string, requesterUid: string): Promise<JoinRequest | null> {
    const snap = await this.col(cellId)
      .where('requesterUid', '==', requesterUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return toEntity(d.id, d.data() as Omit<JoinRequestProps, 'id'>);
  }

  async findAll(cellId: string, opts: JoinRequestListOptions): Promise<JoinRequestListResult> {
    let q = this.col(cellId) as FirebaseFirestore.Query;
    if (opts.status) q = q.where('status', '==', opts.status);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'desc').limit(opts.limit);

    if (opts.cursor) {
      const cs = await this.col(cellId).doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }

    const snap  = await q.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as Omit<JoinRequestProps, 'id'>));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(req: JoinRequest): Promise<void> {
    const { id, ...doc } = { ...req } as JoinRequestProps;
    await this.col(req.cellId).doc(id).set(doc);
  }

  async update(req: JoinRequest): Promise<void> {
    const { id, ...doc } = { ...req } as JoinRequestProps;
    await this.col(req.cellId).doc(id).update(doc as Record<string, unknown>);
  }
}
