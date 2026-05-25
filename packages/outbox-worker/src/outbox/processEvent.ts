import { getFirestore }    from 'firebase-admin/firestore';
import { logger }          from '@shared/logger';
import { EventDispatcher } from '../dispatcher/EventDispatcher';

export interface OutboxDoc {
  eventType:   string;
  payload:     unknown;
  requestId:   string;
  status:      'pending' | 'processing' | 'delivered' | 'failed';
  attempts:    number;
  createdAt:   string;
  processedAt: string | null;
  error:       string | null;
}

const MAX_ATTEMPTS = 5;

export async function processEvent(
  id:         string,
  data:       OutboxDoc,
  dispatcher: EventDispatcher,
): Promise<void> {
  const ref = getFirestore().collection('outbox').doc(id);

  await ref.update({ status: 'processing' });

  try {
    await dispatcher.dispatch(data.eventType, data.payload, data.requestId);
    await ref.update({ status: 'delivered', processedAt: new Date().toISOString() });
    logger.info({ id, eventType: data.eventType }, 'Outbox: delivered');
  } catch (err: unknown) {
    const attempts = (data.attempts ?? 0) + 1;
    const error    = err instanceof Error ? err.message : String(err);

    if (attempts >= MAX_ATTEMPTS) {
      await ref.update({ status: 'failed', attempts, error });
      logger.error({ id, eventType: data.eventType, attempts, error }, 'Outbox: failed after max retries');
    } else {
      await ref.update({ status: 'pending', attempts });
      logger.warn({ id, eventType: data.eventType, attempts }, 'Outbox: dispatch failed — will retry');
    }
  }
}
