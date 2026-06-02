import { getFirestore }                                            from 'firebase-admin/firestore';
import { createHttpError }                                        from '@shared/errors';
import { RoleRequest, RoleRequestProps }                          from '../../domain/entities/RoleRequest';
import { IRoleRequestRepository, RoleRequestListOptions, RoleRequestListResult } from '../../domain/repositories/IRoleRequestRepository';

type RoleRequestDoc = Omit<RoleRequestProps, 'id'>;

function toEntity(id: string, data: RoleRequestDoc): RoleRequest {
  return new RoleRequest({ ...data, id });
}

export class FirestoreRoleRequestRepository implements IRoleRequestRepository {
  private readonly col   = getFirestore().collection('role_requests');
  private readonly slots = getFirestore().collection('role_request_slots');

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

  async findApprovedByRequester(requesterUid: string): Promise<RoleRequest | null> {
    const snap = await this.col
      .where('requesterUid', '==', requesterUid)
      .where('status',       '==', 'approved')
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

  async createUnique(req: RoleRequest): Promise<void> {
    const db      = getFirestore();
    const slotRef = this.slots.doc(req.requesterUid);

    await db.runTransaction(async tx => {
      // Point read on a deterministic document ID — Firestore's optimistic concurrency
      // serializes concurrent transactions that both read AND write slotRef. One commits;
      // the other aborts, retries, finds the slot exists, and returns 409. This closes
      // the TOCTOU race that compound query reads (where().where()) cannot prevent.
      const slotSnap = await tx.get(slotRef);
      if (slotSnap.exists) {
        throw createHttpError(409, 'ROLE_REQUEST_PENDING', 'You already have a pending role request.');
      }

      // Approved check: compound query is safe here — no concurrent race exists because
      // approval is admin-only and does not create new documents concurrently with a POST.
      const approvedSnap = await tx.get(
        this.col
          .where('requesterUid', '==', req.requesterUid)
          .where('status', '==', 'approved')
          .limit(1),
      );
      if (!approvedSnap.empty) {
        throw createHttpError(409, 'ROLE_ALREADY_GRANTED', 'Your role request has already been approved.');
      }

      const { id, ...doc } = { ...req } as RoleRequestProps;
      tx.set(slotRef, {
        requesterUid:  req.requesterUid,
        requestedRole: req.requestedRole,
        requestId:     id,
        createdAt:     req.createdAt,
      });
      tx.set(this.col.doc(id), doc);
    });
  }

  async releaseSlot(requesterUid: string): Promise<void> {
    // delete() is a no-op when the document does not exist — safe for legacy requests
    // created before this fix (no slot document) and for any retried cleanup calls.
    await this.slots.doc(requesterUid).delete();
  }

  async update(req: RoleRequest): Promise<void> {
    const { id, ...doc } = { ...req } as RoleRequestProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }
}
