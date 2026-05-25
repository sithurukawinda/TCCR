import { getFirestore } from 'firebase-admin/firestore';
import { OutboxEventPublisher } from '@shared/events';
import { logger }               from '@shared/logger';

interface SemesterDoc {
  courseId:  string;
  title:     string;
  status?:   string;
  endDate?:  string | null;
  deletedAt: string | null;
  updatedAt: string;
}

export async function runSemesterSweep(): Promise<void> {
  const outbox = new OutboxEventPublisher();
  const db    = getFirestore();
  const col   = db.collection('semesters');
  const nowIso = new Date().toISOString();
  const today  = nowIso.split('T')[0]; // YYYY-MM-DD

  // Find active semesters whose endDate has passed
  // endDate is stored as 'YYYY-MM-DD'; compare with today
  const toDisable = await col
    .where('deletedAt', '==', null)
    .where('status',    '==', 'active')
    .where('endDate',   '<',  today)
    .get();

  // Filter to only those that actually have a non-null endDate
  const valid = toDisable.docs.filter(d => {
    const data = d.data() as SemesterDoc;
    return data.endDate !== null && data.endDate !== undefined;
  });

  if (valid.length === 0) return;

  for (const doc of valid) {
    const data = doc.data() as SemesterDoc;

    await col.doc(doc.id).update({
      status:    'disabled',
      updatedAt: nowIso,
    });

    await outbox.publishWithBatch({
      type:      'audit.action',
      payload:   {
        actor:      null,
        action:     'semester.disabled',
        category:   'course',
        targetType: 'semester',
        targetId:   doc.id,
        metadata:   { courseId: data.courseId, endDate: data.endDate },
      },
      requestId: `semester-sweep-${doc.id}`,
    });

    logger.info({ semesterId: doc.id, courseId: data.courseId, endDate: data.endDate }, 'Semester auto-disabled');
  }

  logger.info({ count: valid.length }, 'Semester sweep complete');
}
