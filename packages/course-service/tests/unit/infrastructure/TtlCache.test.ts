import { TtlCache } from '../../../src/infrastructure/cache/TtlCache';

describe('TtlCache', () => {
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => nowSpy.mockRestore());

  describe('set / get', () => {
    it('returns the stored value within TTL', () => {
      const cache = new TtlCache<string>(500);
      cache.set('key', 'hello');
      nowSpy.mockReturnValue(1200); // 200 ms later — still within 500 ms TTL
      expect(cache.get('key')).toBe('hello');
    });

    it('returns undefined for a key that was never set', () => {
      const cache = new TtlCache<number>(500);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('returns undefined and evicts entry after TTL expires', () => {
      const cache = new TtlCache<string>(500);
      cache.set('key', 'value');
      nowSpy.mockReturnValue(1501); // 501 ms later — past TTL
      expect(cache.get('key')).toBeUndefined();
    });

    it('evicts only the expired key, not others', () => {
      const cache = new TtlCache<number>(500);
      cache.set('a', 1);
      nowSpy.mockReturnValue(1200);
      cache.set('b', 2); // set at t=1200, expires at 1700
      nowSpy.mockReturnValue(1600); // a expired (1000+500=1500), b still valid
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });

    it('overwrites an existing key with a fresh TTL', () => {
      const cache = new TtlCache<string>(500);
      cache.set('key', 'first');
      nowSpy.mockReturnValue(1400);
      cache.set('key', 'second'); // refreshes TTL from 1400
      nowSpy.mockReturnValue(1800); // first TTL expired (1500), second still valid (1900)
      expect(cache.get('key')).toBe('second');
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      const cache = new TtlCache<number>(10_000);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });

    it('allows new entries after clear', () => {
      const cache = new TtlCache<string>(10_000);
      cache.set('k', 'old');
      cache.clear();
      cache.set('k', 'new');
      expect(cache.get('k')).toBe('new');
    });
  });

  describe('typed values', () => {
    it('stores and retrieves an object', () => {
      const cache = new TtlCache<{ items: number[]; total: number }>(1000);
      const val = { items: [1, 2, 3], total: 3 };
      cache.set('list', val);
      expect(cache.get('list')).toStrictEqual(val);
    });
  });
});
