import { getMessaging } from 'firebase-admin/messaging';

export class FcmClient {
  async sendPush(fcmToken: string, title: string, body: string): Promise<void> {
    await getMessaging().send({ token: fcmToken, notification: { title, body } });
  }
}
