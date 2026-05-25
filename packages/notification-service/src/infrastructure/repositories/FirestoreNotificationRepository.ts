import { getFirestore }                  from 'firebase-admin/firestore';
import { Notification, NotificationProps } from '../../domain/entities/Notification';
import { INotificationRepository, NotificationListOptions, NotificationListResult } from '../../domain/repositories/INotificationRepository';

type NotifDoc = Omit<NotificationProps, 'id'>;

export class FirestoreNotificationRepository implements INotificationRepository {
  private readonly col = getFirestore().collection('notifications');

  async findByUser(userUid: string, opts: NotificationListOptions): Promise<NotificationListResult> {
    let q: FirebaseFirestore.Query = this.col.where('userUid', '==', userUid);
    if (opts.read !== undefined) q = q.where('read', '==', opts.read);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }
    const snap  = await q.get();
    const items = snap.docs.map(d => new Notification({ ...(d.data() as NotifDoc), id: d.id }));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(n: Notification): Promise<void> {
    const { id, ...doc } = { ...n } as NotificationProps;
    await this.col.doc(id).set(doc);
  }

  async markRead(id: string, _userUid: string): Promise<void> {
    await this.col.doc(id).update({ read: true });
  }

  async markAllRead(userUid: string): Promise<void> {
    const snap  = await this.col.where('userUid', '==', userUid).where('read', '==', false).get();
    const batch = getFirestore().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
}
