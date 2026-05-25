import { getFirestore }                                            from 'firebase-admin/firestore';
import { RoleRequest, RoleRequestProps }                          from '../../domain/entities/RoleRequest';
import { IRoleRequestRepository, RoleRequestListOptions, RoleRequestListResult } from '../../domain/repositories/IRoleRequestRepository';

type RoleRequestDoc = Omit<RoleRequestProps, 'id'>;

function toEntity(id: string, data: RoleRequestDoc): RoleRequest {
  return new RoleRequest({ ...data, id });
}

export class FirestoreRoleRequestRepository implements IRoleRequestRepository {
  private readonly col = getFirestore().collection('role_requests');

  async findById(id: string): Promise<RoleRequest | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as RoleRequestDoc);
  }

  async findPendingByRequester(requesterUid: string): Promise<RoleRequest | null> {
    const snap = await this.col
      .where('requesterUid', '==', requesterUid)
      .where('status',       '==', 'pending')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return toEntity(doc.id, doc.data() as RoleRequestDoc);
  }

  async findByRequester(requesterUid: string): Promise<RoleRequest[]> {
    const snap = await this.col
      .where('requesterUid', '==', requesterUid)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as RoleRequestDoc));
  }

  async findAll(opts: RoleRequestListOptions): Promise<RoleRequestListResult> {
    let q: FirebaseFirestore.Query = this.col;
    if (opts.status) q = q.where('status', '==', opts.status);

    const total = (await q.count().get()).data().count;
    let paged   = q.orderBy('createdAt', 'desc').limit(opts.limit);

    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) paged = paged.startAfter(cs);
    }

    const snap  = await paged.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as RoleRequestDoc));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(req: RoleRequest): Promise<void> {
    const { id, ...doc } = { ...req } as RoleRequestProps;
    await this.col.doc(id).set(doc);
  }

  async update(req: RoleRequest): Promise<void> {
    const { id, ...doc } = { ...req } as RoleRequestProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }
}
