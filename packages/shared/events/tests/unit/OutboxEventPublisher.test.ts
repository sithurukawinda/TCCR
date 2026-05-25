import { OutboxEventPublisher } from '../../src/OutboxEventPublisher';

// ── Mock Firestore ────────────────────────────────────────────────────────────
const mockSet   = jest.fn().mockResolvedValue(undefined);
const mockDoc   = jest.fn().mockReturnValue({ set: mockSet });
const mockBatchSet = jest.fn();

const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mockCollection }),
}));

// ── Mock uuid ─────────────────────────────────────────────────────────────────
jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('OutboxEventPublisher', () => {
  const publisher = new OutboxEventPublisher();

  const input = {
    type:      'enrollment.approved',
    payload:   { studentUid: 'uid-1', courseId: 'course-1' },
    requestId: 'req-abc',
  };

  beforeEach(() => jest.clearAllMocks());

  it('writes to the outbox collection when no batch is provided', async () => {
    await publisher.publishWithBatch(input);

    expect(mockCollection).toHaveBeenCalledWith('outbox');
    expect(mockDoc).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id:        'test-uuid-1234',
        eventType: 'enrollment.approved',
        payload:   input.payload,
        requestId: 'req-abc',
        status:    'pending',
        attempts:  0,
      }),
    );
  });

  it('uses batch.set when a batch is provided — does NOT call ref.set directly', async () => {
    const batch = { set: mockBatchSet } as any;

    await publisher.publishWithBatch(input, batch);

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id:        'test-uuid-1234',
        eventType: 'enrollment.approved',
        status:    'pending',
      }),
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('sets initial status to pending and attempts to 0', async () => {
    await publisher.publishWithBatch(input);

    const written = mockSet.mock.calls[0][0];
    expect(written.status).toBe('pending');
    expect(written.attempts).toBe(0);
    expect(written.processedAt).toBeNull();
    expect(written.error).toBeNull();
  });

  it('sets createdAt as an ISO 8601 string', async () => {
    await publisher.publishWithBatch(input);

    const written = mockSet.mock.calls[0][0];
    expect(() => new Date(written.createdAt)).not.toThrow();
    expect(written.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('generates a unique id (uuid) for each event', async () => {
    await publisher.publishWithBatch(input);

    const written = mockSet.mock.calls[0][0];
    expect(written.id).toBe('test-uuid-1234');
  });

  it('stores the correct eventType, payload, and requestId', async () => {
    const customInput = {
      type:      'user.registered',
      payload:   { email: 'test@example.com' },
      requestId: 'req-xyz',
    };

    await publisher.publishWithBatch(customInput);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'user.registered',
        payload:   { email: 'test@example.com' },
        requestId: 'req-xyz',
      }),
    );
  });
});
