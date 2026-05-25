import { getFirestore } from 'firebase-admin/firestore';
import { OutboxEventPublisher }       from '@shared/events';
import { logger }                     from '@shared/logger';

interface BatchDoc {
  courseId:        string;
  name:            string;
  state:           'draft' | 'open' | 'closed';
  scheduledOpenAt: string | null;
  intakeStart:     string;
  intakeEnd:       string;
  createdAt:       string;
  updatedAt:       string;
}

export async function runBatchSweep(): Promise<void> {
  const outbox = new OutboxEventPublisher();
  const db    = getFirestore();
  const col   = db.collection('batches');
  const now   = new Date();
  const nowIso = now.toISOString();
  const today  = nowIso.split('T')[0]; // YYYY-MM-DD

  let opened = 0;
  let closed = 0;

  // ── 1. Open drafts whose scheduledOpenAt has passed ──────────────────────

  const draftsToOpen = await col
    .where('state', '==', 'draft')
    .where('scheduledOpenAt', '<=', nowIso)
    .get();

  for (const doc of draftsToOpen.docs) {
    const data = doc.data() as BatchDoc;
    if (!data.scheduledOpenAt) continue; // safety guard

    await col.doc(doc.id).update({
      state:     'open',
      updatedAt: nowIso,
    });

    await outbox.publishWithBatch({
      type:      'audit.action',
      payload:   {
        actor:      null,
        action:     'batch.auto_opened',
        category:   'batch',
        targetType: 'batch',
        targetId:   doc.id,
        metadata:   { courseId: data.courseId, scheduledOpenAt: data.scheduledOpenAt },
      },
      requestId: `batch-sweep-${doc.id}`,
    });

    opened++;
    logger.info({ batchId: doc.id, courseId: data.courseId }, 'Batch auto-opened');
  }

  // ── 2. Close opens whose intakeEnd has passed ─────────────────────────────
  // intakeEnd is a YYYY-MM-DD string; compare with today

  const opensToClose = await col
    .where('state', '==', 'open')
    .where('intakeEnd', '<', today)
    .get();

  for (const doc of opensToClose.docs) {
    const data = doc.data() as BatchDoc;

    await col.doc(doc.id).update({
      state:     'closed',
      updatedAt: nowIso,
    });

    await outbox.publishWithBatch({
      type:      'audit.action',
      payload:   {
        actor:      null,
        action:     'batch.window_closed',
        category:   'batch',
        targetType: 'batch',
        targetId:   doc.id,
        metadata:   { courseId: data.courseId, intakeEnd: data.intakeEnd },
      },
      requestId: `batch-sweep-${doc.id}`,
    });

    closed++;
    logger.info({ batchId: doc.id, courseId: data.courseId }, 'Batch auto-closed (intake window passed)');
  }

  if (opened + closed > 0) {
    logger.info({ opened, closed }, 'Batch sweep complete');
  }
}
