import { Batch } from '../../../src/domain/entities/Batch';

const make = (overrides: Partial<ConstructorParameters<typeof Batch>[0]> = {}): Batch => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split('T')[0];
  const tomorrow  = new Date(now.getTime() + 86_400_000).toISOString().split('T')[0];
  return new Batch({
    id: 'b-1', courseId: 'c-1', name: '2026 Intake',
    scheduledOpenAt: null,
    intakeStart: yesterday, intakeEnd: tomorrow,
    capacity: null, state: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
};

describe('Batch entity', () => {
  describe('open()', () => {
    it('transitions DRAFT → OPEN', () => {
      const b = make({ state: 'draft' });
      b.open();
      expect(b.state).toBe('open');
    });

    it('updates updatedAt', () => {
      const b = make();
      const before = b.updatedAt;
      b.open();
      expect(b.updatedAt).not.toBe(before);
    });

    it('throws 409 when batch is not DRAFT', () => {
      const b = make({ state: 'open' });
      expect(() => b.open()).toThrow(expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }));
    });

    it('throws 409 when batch is CLOSED', () => {
      const b = make({ state: 'closed' });
      expect(() => b.open()).toThrow(expect.objectContaining({ status: 409 }));
    });
  });

  describe('close()', () => {
    it('transitions OPEN → CLOSED', () => {
      const b = make({ state: 'open' });
      b.close();
      expect(b.state).toBe('closed');
    });

    it('updates updatedAt', () => {
      const b = make({ state: 'open' });
      const before = b.updatedAt;
      b.close();
      expect(b.updatedAt).not.toBe(before);
    });

    it('throws 409 when batch is not OPEN', () => {
      const b = make({ state: 'draft' });
      expect(() => b.close()).toThrow(expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }));
    });
  });

  describe('isEnrollable()', () => {
    it('returns true when open and within intake window', () => {
      expect(make({ state: 'open' }).isEnrollable()).toBe(true);
    });

    it('returns false when state is draft', () => {
      expect(make({ state: 'draft' }).isEnrollable()).toBe(false);
    });

    it('returns false when state is closed', () => {
      expect(make({ state: 'closed' }).isEnrollable()).toBe(false);
    });

    it('returns false when intakeStart is in the future', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const far    = new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0];
      expect(make({ state: 'open', intakeStart: future, intakeEnd: far }).isEnrollable()).toBe(false);
    });

    it('returns false when intakeEnd has passed', () => {
      const past1 = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0];
      const past2 = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
      expect(make({ state: 'open', intakeStart: past1, intakeEnd: past2 }).isEnrollable()).toBe(false);
    });
  });

  describe('update()', () => {
    it('updates name', () => {
      const b = make();
      b.update({ name: 'New Intake' });
      expect(b.name).toBe('New Intake');
    });

    it('updates scheduledOpenAt', () => {
      const b = make();
      b.update({ scheduledOpenAt: '2026-06-01T00:00:00.000Z' });
      expect(b.scheduledOpenAt).toBe('2026-06-01T00:00:00.000Z');
    });

    it('updates capacity', () => {
      const b = make();
      b.update({ capacity: 50 });
      expect(b.capacity).toBe(50);
    });

    it('clears scheduledOpenAt when null passed', () => {
      const b = make({ scheduledOpenAt: '2026-06-01T00:00:00.000Z' });
      b.update({ scheduledOpenAt: null });
      expect(b.scheduledOpenAt).toBeNull();
    });

    it('does not change name when not provided', () => {
      const b = make({ name: 'Original' });
      b.update({ capacity: 30 });
      expect(b.name).toBe('Original');
    });
  });
});
