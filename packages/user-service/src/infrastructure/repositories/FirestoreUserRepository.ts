import { getFirestore }                                                      from 'firebase-admin/firestore';
import { User, UserRole, UserProps, NotificationPreferences, Qualification, Gender } from '../../domain/entities/User';
import { IUserRepository, FindAllOptions, FindAllResult }                   from '../../domain/repositories/IUserRepository';

function toUser(id: string, data: FirebaseFirestore.DocumentData): User {
  const role = data.role as UserRole;
  return new User({
    uid:               id,
    email:             data.email as string,
    firstName:         (data.firstName as string | null | undefined) ?? '',
    lastName:          (data.lastName  as string | null | undefined) ?? '',
    role,
    roles:             (data.roles as UserRole[] | undefined) ?? [role],
    status:            data.status as UserProps['status'],
    profilePhotoUrl:   (data.profilePhotoUrl as string | null) ?? null,
    phoneNumber:       (data.phoneNumber as string | null | undefined) ?? null,
    preferredLanguage: (data.preferredLanguage as string | undefined) ?? 'en',
    fcmTokens:                  (data.fcmTokens as string[] | undefined) ?? [],
    notificationPreferences:    (data.notificationPreferences as NotificationPreferences | undefined) ?? { email: true, push: true },
    providers:                  (data.providers as string[] | undefined) ?? ['password'],
    // Extended profile fields
    dateOfBirth:                (data.dateOfBirth as string | null | undefined) ?? null,
    gender:                     (data.gender as Gender | null | undefined) ?? null,
    address:                    (data.address as string | null | undefined) ?? null,
    qualifications:             (data.qualifications as Qualification[] | undefined) ?? [],
    qualificationTitle:         (data.qualificationTitle as string | null | undefined) ?? null,
    qualificationUrl:           (data.qualificationUrl as string | null | undefined) ?? null,
    qualificationStoragePath:   (data.qualificationStoragePath as string | null | undefined) ?? null,
    createdAt:                  data.createdAt as string,
    updatedAt:                  data.updatedAt as string,
    deletedAt:                  (data.deletedAt as string | null) ?? null,
  });
}

export class FirestoreUserRepository implements IUserRepository {
  private readonly col = getFirestore().collection('users');

  async findById(uid: string): Promise<User | null> {
    const snap = await this.col.doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    if (data.deletedAt !== null) return null;
    return toUser(snap.id, data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const snap = await this.col
      .where('email',     '==', email)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return toUser(doc.id, doc.data());
  }

  async findAll(opts: FindAllOptions): Promise<FindAllResult> {
    let base: FirebaseFirestore.Query = this.col.where('deletedAt', '==', null);
    if (opts.role)   base = base.where('role',   '==', opts.role);
    if (opts.status) base = base.where('status', '==', opts.status);

    if (opts.name) {
      // Prefix search on firstName — orderBy switches to firstName asc
      const end = opts.name + '';
      base = base.where('firstName', '>=', opts.name).where('firstName', '<=', end);

      // Run count and cursor fetch in parallel to avoid two sequential round-trips
      const [countSnap, cursorSnap] = await Promise.all([
        base.count().get(),
        opts.cursor ? this.col.doc(opts.cursor).get() : Promise.resolve(null),
      ]);
      const total = countSnap.data().count;

      let query = base.orderBy('firstName', 'asc').limit(opts.limit);
      if (cursorSnap?.exists) query = query.startAfter(cursorSnap);

      const snap = await query.get();
      let items  = snap.docs.map(d => toUser(d.id, d.data()));
      if (opts.excludeRoles?.length) {
        items = items.filter(u => !u.roles.some(r => opts.excludeRoles!.includes(r)));
      }
      const last = snap.docs[snap.docs.length - 1];
      return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
    }

    // Run count and cursor fetch in parallel to avoid two sequential round-trips
    const [countSnap, cursorSnap] = await Promise.all([
      base.count().get(),
      opts.cursor ? this.col.doc(opts.cursor).get() : Promise.resolve(null),
    ]);
    const total = countSnap.data().count;

    let query = base.orderBy('createdAt', 'desc').limit(opts.limit);
    if (cursorSnap?.exists) query = query.startAfter(cursorSnap);

    const snap = await query.get();
    let items  = snap.docs.map(d => toUser(d.id, d.data()));
    if (opts.excludeRoles?.length) {
      items = items.filter(u => !u.roles.some(r => opts.excludeRoles!.includes(r)));
    }
    const last = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(user: User): Promise<void> {
    const { uid, ...doc } = { ...user } as UserProps;
    await this.col.doc(uid).set(doc);
  }

  async update(user: User): Promise<void> {
    const { uid, ...doc } = { ...user } as UserProps;
    await this.col.doc(uid).update(doc as Record<string, unknown>);
  }

  async softDelete(uid: string): Promise<void> {
    await this.col.doc(uid).update({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async hardDelete(uid: string): Promise<void> {
    await this.col.doc(uid).delete();
  }
}
