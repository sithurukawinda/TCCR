/**
 * E2E Smoke Tests — run against staging after each deployment.
 * Set STAGING_URL env var to the gateway base URL, e.g. https://api-staging.yourdomain.com
 */

const BASE_URL = process.env.STAGING_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res  = await fetch(`${BASE_URL}${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res    = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
}

describe('Smoke Tests — Staging', () => {

  it('GET /api/v1/healthz returns 200', async () => {
    const { status } = await get('/api/v1/healthz');
    expect(status).toBe(200);
  }, 10_000);

  it('GET /api/v1/readyz returns 200', async () => {
    const { status } = await get('/api/v1/readyz');
    expect(status).toBe(200);
  }, 10_000);

  it('GET /api/v1/courses returns 200 with paginated shape', async () => {
    const { status, body } = await get('/api/v1/courses');
    expect(status).toBe(200);
    expect(body).toMatchObject({ items: expect.any(Array) });
  }, 10_000);

  it('POST /api/v1/auth/register with weak password returns 400', async () => {
    const { status } = await post('/api/v1/auth/register', {
      firstName: 'Test', lastName: 'User',
      email: `smoke-${Date.now()}@test.com`,
      password: 'weak',
    });
    expect(status).toBe(400);
  }, 10_000);

  it('GET /api/v1/me without token returns 401', async () => {
    const { status } = await get('/api/v1/me');
    expect(status).toBe(401);
  }, 10_000);

  it('Auth rate limiter returns 429 after 11 rapid requests', async () => {
    const requests = Array.from({ length: 11 }, () =>
      post('/api/v1/auth/password-reset', { email: 'rate@test.com' }),
    );
    const results = await Promise.all(requests);
    const has429  = results.some(r => r.status === 429);
    expect(has429).toBe(true);
  }, 30_000);

});
