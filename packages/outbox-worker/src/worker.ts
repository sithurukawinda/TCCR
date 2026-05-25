import { initFirebaseAdmin } from '@shared/firebase';
import { logger }            from '@shared/logger';
import { getFirestore }      from 'firebase-admin/firestore';
import { config }            from './config';
import { EventDispatcher }   from './dispatcher/EventDispatcher';
import { processEvent, OutboxDoc } from './outbox/processEvent';

initFirebaseAdmin();

const dispatcher = new EventDispatcher();

async function processBatch(): Promise<void> {
  const db   = getFirestore();
  const snap = await db.collection('outbox')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(config.batchSize)
    .get();

  if (snap.empty) return;

  logger.info({ count: snap.size }, 'Outbox: processing batch');

  await Promise.allSettled(
    snap.docs.map(doc => processEvent(doc.id, doc.data() as OutboxDoc, dispatcher)),
  );
}

const intervalMs = config.pollIntervalSeconds * 1000;

setInterval(() => {
  processBatch().catch((err: unknown) => {
    logger.error({ err }, 'Outbox: batch processing error');
  });
}, intervalMs);

logger.info({ intervalMs, batchSize: config.batchSize }, config.serviceName + ' started');
