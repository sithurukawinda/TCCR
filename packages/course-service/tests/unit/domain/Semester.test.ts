import { Semester } from '../../../src/domain/entities/Semester';

const make = (overrides: Partial<ConstructorParameters<typeof Semester>[0]> = {}): Semester =>
  new Semester({
    id: 'sem-1', courseId: 'c-1', title: 'Semester 1',
    subjectCount: 2, order: 1,
    openDate: null, endDate: null, status: 'active',
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

describe('Semester entity', () => {
  describe('isAccessible()', () => {
    it('returns true when active with no dates set', () => {
      expect(make().isAccessible()).toBe(true);
    });

    it('returns false when status is disabled', () => {
      expect(make({ status: 'disabled' }).isAccessible()).toBe(false);
    });

    it('returns false when openDate is in the future', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(make({ openDate: future }).isAccessible()).toBe(false);
    });

    it('returns true when openDate is in the past', () => {
      const past = new Date(Date.now() - 86_400_000).toISOString();
      expect(make({ openDate: past }).isAccessible()).toBe(true);
    });
  });

  describe('disable()', () => {
    it('sets status to disabled', () => {
      const sem = make();
      sem.disable();
      expect(sem.status).toBe('disabled');
    });

    it('updates updatedAt', () => {
      const sem = make();
      const before = sem.updatedAt;
      sem.disable();
      expect(sem.updatedAt).not.toBe(before);
    });
  });

  describe('update()', () => {
    it('updates title when provided', () => {
      const sem = make();
      sem.update({ title: 'New Title' });
      expect(sem.title).toBe('New Title');
    });

    it('updates openDate and endDate when provided', () => {
      const sem = make();
      sem.update({ openDate: '2026-06-01', endDate: '2026-09-30' });
      expect(sem.openDate).toBe('2026-06-01');
      expect(sem.endDate).toBe('2026-09-30');
    });

    it('clears openDate when null is passed', () => {
      const sem = make({ openDate: '2026-06-01' });
      sem.update({ openDate: null });
      expect(sem.openDate).toBeNull();
    });

    it('does not change title when not provided', () => {
      const sem = make({ title: 'Original' });
      sem.update({ endDate: '2026-09-30' });
      expect(sem.title).toBe('Original');
    });
  });

  describe('softDelete()', () => {
    it('sets deletedAt to a timestamp', () => {
      const sem = make();
      sem.softDelete();
      expect(sem.deletedAt).not.toBeNull();
    });

    it('updates updatedAt', () => {
      const sem = make();
      const before = sem.updatedAt;
      sem.softDelete();
      expect(sem.updatedAt).not.toBe(before);
    });
  });
});
