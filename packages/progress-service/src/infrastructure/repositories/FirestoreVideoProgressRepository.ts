import { getFirestore }                               from 'firebase-admin/firestore';
import { VideoProgress, VideoProgressProps }           from '../../domain/entities/VideoProgress';
import { IVideoProgressRepository }                   from '../../domain/repositories/IVideoProgressRepository';

type VideoProgressDoc = Omit<VideoProgressProps, 'id'>;

export class FirestoreVideoProgressRepository implements IVideoProgressRepository {
  private readonly col = getFirestore().collection('video_progress');

  private toEntity(id: string, data: VideoProgressDoc): VideoProgress {
    return new VideoProgress({ id, ...data });
  }

  async findByStudentAndLesson(studentUid: string, lessonId: string): Promise<VideoProgress | null> {
    const snap = await this.col.doc(`${studentUid}_${lessonId}`).get();
    if (!snap.exists) return null;
    return this.toEntity(snap.id, snap.data() as VideoProgressDoc);
  }

  async save(progress: VideoProgress): Promise<void> {
    const { id, ...doc } = { ...progress } as VideoProgressProps;
    await this.col.doc(id).set(doc, { merge: true });
  }
}
