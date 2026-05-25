import { getFirestore }    from 'firebase-admin/firestore';
import { Registration, RegistrationProps } from '../../domain/entities/Registration';
import { IRegistrationRepository, RegistrationListOptions, RegistrationListResult } from '../../domain/repositories/IRegistrationRepository';

type RegDoc = Omit<RegistrationProps, 'id'>;

export class FirestoreRegistrationRepository implements IRegistrationRepository {
  private readonly col = getFirestore().collection('registrations');

  async findById(id: string): Promise<Registration | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return new Registration({ ...(snap.data() as RegDoc), id: snap.id });
  }

  async findAll(opts: RegistrationListOptions): Promise<RegistrationListResult> {
    let q = this.col as FirebaseFirestore.Query;
    if (opts.state) q = q.where('state', '==', opts.state);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'asc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }
    const snap  = await q.get();
    const items = snap.docs.map(d => new Registration({ ...(d.data() as RegDoc), id: d.id }));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(reg: Registration): Promise<void> {
    const { id, ...doc } = { ...reg } as RegistrationProps;
    await this.col.doc(id).set(doc);
  }

  async update(reg: Registration): Promise<void> {
    const { id, ...doc } = { ...reg } as RegistrationProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }
}
