import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export const notifyClient = createInternalClient(config.serviceNotifyUrl, config.internalServiceKey);
export const auditClient  = createInternalClient(config.serviceAuditUrl,  config.internalServiceKey);
export const userClient   = createInternalClient(config.serviceUserUrl,   config.internalServiceKey);

export async function sendEvent(client: ReturnType<typeof createInternalClient>, eventType: string, payload: unknown, requestId: string): Promise<void> {
  await client.post('/internal/events', { eventType, payload, requestId });
}
