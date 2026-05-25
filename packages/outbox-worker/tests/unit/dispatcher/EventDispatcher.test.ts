const mockSendEvent = jest.fn().mockResolvedValue(undefined);
const mockPost      = jest.fn().mockResolvedValue({ data: {} });

jest.mock('../../../src/infrastructure/clients/ServiceClient', () => ({
  notifyClient: { post: mockPost },
  auditClient:  { post: mockPost },
  userClient:   { post: mockPost },
  sendEvent:    mockSendEvent,
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { EventDispatcher } from '../../../src/dispatcher/EventDispatcher';

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatcher = new EventDispatcher();
  });

  it('dispatches known event type without throwing', async () => {
    await expect(
      dispatcher.dispatch('user.registered', { uid: 'uid1' }, 'req-1'),
    ).resolves.toBeUndefined();
    expect(mockSendEvent).toHaveBeenCalled();
  });

  it('handles unknown event type — logs warning, does not throw', async () => {
    await expect(
      dispatcher.dispatch('completely.unknown', {}, 'req-1'),
    ).resolves.toBeUndefined();
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it('dispatches audit.action only to audit service', async () => {
    await dispatcher.dispatch('audit.action', { action: 'test' }, 'req-1');
    expect(mockSendEvent).toHaveBeenCalledTimes(1);
  });

  it('dispatches registration.approved to user-service + notify + audit', async () => {
    await dispatcher.dispatch('registration.approved', { studentUid: 'uid1' }, 'req-1');
    // 1 userClient.post + 2 sendEvent calls
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockSendEvent).toHaveBeenCalledTimes(2);
  });
});
