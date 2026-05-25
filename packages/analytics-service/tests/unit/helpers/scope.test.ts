import { resolveScope, getISOWeekKey, lastNWeekKeys } from '../../../src/application/helpers/scope';

describe('resolveScope()', () => {
  it('returns "org" for admin', () => {
    expect(resolveScope('uid', ['admin'])).toBe('org');
  });
  it('returns "org" for super_admin', () => {
    expect(resolveScope('uid', ['super_admin'])).toBe('org');
  });
  it('returns "g12:{uid}" for g12 (takes precedence over leader)', () => {
    expect(resolveScope('g12-uid', ['member', 'leader', 'g12'])).toBe('g12:g12-uid');
  });
  it('returns "leader:{uid}" for leader', () => {
    expect(resolveScope('leader-uid', ['member', 'leader'])).toBe('leader:leader-uid');
  });
});

describe('getISOWeekKey()', () => {
  it('returns YYYY-WNN format', () => {
    const key = getISOWeekKey(new Date('2026-05-17'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
  it('returns 2026-W19 for May 11 2026 (ISO week 20)', () => {
    // May 11 2026 is a Monday
    const key = getISOWeekKey(new Date('2026-05-11'));
    expect(key).toBe('2026-W20');
  });
});

describe('lastNWeekKeys()', () => {
  it('returns exactly N keys', () => {
    expect(lastNWeekKeys(4)).toHaveLength(4);
    expect(lastNWeekKeys(12)).toHaveLength(12);
  });
  it('keys are in ascending order', () => {
    const keys = lastNWeekKeys(4);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i] >= keys[i - 1]).toBe(true);
    }
  });
  it('last key is current week', () => {
    const keys    = lastNWeekKeys(3);
    const current = getISOWeekKey(new Date());
    expect(keys[keys.length - 1]).toBe(current);
  });
});
