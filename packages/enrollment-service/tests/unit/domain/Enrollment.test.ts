import { Enrollment } from '../../../src/domain/entities/Enrollment';

const make = (state: 'pending' | 'approved' | 'rejected' | 'withdrawn' = 'pending'): Enrollment =>
  new Enrollment({
    id: 'uid1_course1', studentUid: 'uid1', courseId: 'course1',
    state, reason: null,
    rejectedAt: null, approvedAt: null, withdrawnAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

describe('Enrollment entity', () => {
  describe('approve()', () => {
    it('transitions PENDING → approved', () => {
      const e = make('pending');
      e.approve();
      expect(e.state).toBe('approved');
    });

    it('sets approvedAt', () => {
      const e = make('pending');
      e.approve();
      expect(e.approvedAt).not.toBeNull();
    });

    it('updates updatedAt', () => {
      const e = make();
      const before = e.updatedAt;
      e.approve();
      expect(e.updatedAt).not.toBe(before);
    });

    it('throws 409 when already approved', () => {
      expect(() => make('approved').approve()).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });

    it('throws 409 when rejected', () => {
      expect(() => make('rejected').approve()).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });

  describe('reject()', () => {
    it('transitions PENDING → rejected', () => {
      const e = make('pending');
      e.reject('Capacity full');
      expect(e.state).toBe('rejected');
      expect(e.reason).toBe('Capacity full');
    });

    it('sets rejectedAt', () => {
      const e = make('pending');
      e.reject();
      expect(e.rejectedAt).not.toBeNull();
    });

    it('stores null reason when not provided', () => {
      const e = make('pending');
      e.reject();
      expect(e.reason).toBeNull();
    });

    it('throws 409 when already rejected', () => {
      expect(() => make('rejected').reject()).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });

  describe('withdraw()', () => {
    it('transitions PENDING → withdrawn', () => {
      const e = make('pending');
      e.withdraw();
      expect(e.state).toBe('withdrawn');
    });

    it('transitions APPROVED → withdrawn', () => {
      const e = make('approved');
      e.withdraw();
      expect(e.state).toBe('withdrawn');
    });

    it('sets withdrawnAt', () => {
      const e = make('pending');
      e.withdraw();
      expect(e.withdrawnAt).not.toBeNull();
    });

    it('throws 409 when already rejected', () => {
      expect(() => make('rejected').withdraw()).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });

    it('throws 409 when already withdrawn', () => {
      expect(() => make('withdrawn').withdraw()).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });
});
