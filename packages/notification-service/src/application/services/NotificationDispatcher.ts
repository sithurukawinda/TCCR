import { logger }      from '@shared/logger';
import { EmailClient } from '../../infrastructure/clients/EmailClient';
import { FcmClient }   from '../../infrastructure/clients/FcmClient';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class NotificationDispatcher {
  constructor(
    private readonly emailClient: EmailClient,
    private readonly fcmClient:   FcmClient,
  ) {}

  async dispatchEmail(to: string, subject: string, html: string, requestId: string): Promise<void> {
    // Fire-and-forget: return immediately so the caller can respond 204 before SMTP completes.
    // Gmail SMTP can take 5-10 s; awaiting it causes the outbox-worker's 5 s internal-HTTP
    // timeout to fire, which marks the event "failed" even when the email actually goes out.
    const send = async () => {
      const delays = [1000, 2000, 4000];
      let lastError: unknown;
      for (const delay of delays) {
        try {
          await this.emailClient.sendMail({ to, subject, html });
          return;
        } catch (err) {
          lastError = err;
          await sleep(delay);
        }
      }
      logger.error({ err: lastError, to, requestId }, 'Email delivery failed after 3 retries');
    };
    send().catch(err => logger.error({ err, to, requestId }, 'Email dispatch crashed'));
  }

  async dispatchPush(fcmToken: string, title: string, body: string): Promise<void> {
    try {
      await this.fcmClient.sendPush(fcmToken, title, body);
    } catch (err) {
      logger.warn({ err, fcmToken }, 'Push notification failed (best-effort)');
      // Never throw
    }
  }
}
