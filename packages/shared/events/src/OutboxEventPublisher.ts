import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { v4 as uuidv4 }            from 'uuid';

interface PublishInput {
  type:      string;
  payload:   unknown;
  requestId: string;
}

export class OutboxEventPublisher {
  private readonly db = getFirestore();

  async publishWithBatch(event: PublishInput, batch?: WriteBatch): Promise<void> {
    const entry = {
      id:          uuidv4(),
      eventType:   event.type,
      payload:     event.payload,
      requestId:   event.requestId,
      status:      'pending',
      attempts:    0,
      createdAt:   new Date().toISOString(),
      processedAt: null,
      error:       null,
    };

    const ref = this.db.collection('outbox').doc();

    if (batch) {
      batch.set(ref, entry);
    } else {
      await ref.set(entry);
    }
  }
}
