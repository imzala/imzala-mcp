import { test, expect, vi } from 'vitest';
import { makeClient, ImzalaApiError } from '../client.js';

const okMe = {
  success: true,
  data: {
    id: 'u1',
    email: 'a@b.c',
    first_name: 'A',
    last_name: 'B',
    workspace: { type: 'personal', organization_id: null },
    credits: { remaining: 7 },
  },
};

test('getMe returns data and sends X-API-Key', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(okMe), { status: 200 }),
  );
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://test-api.imzala.org', fetch: fetchMock as any });
  const me = await c.getMe();
  expect(me.credits.remaining).toBe(7);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe('https://test-api.imzala.org/api/v1/me');
  expect((init.headers as any)['X-API-Key']).toBe('imz_x');
});

test('402 maps to ImzalaApiError with code', async () => {
  const body = { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' };
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 402 }),
  );
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await expect(c.getMe()).rejects.toMatchObject({ status: 402, code: 'INSUFFICIENT_CREDITS' });
});

test('createTimestamp posts multipart and forwards Idempotency-Key', async () => {
  const okTs = {
    success: true,
    data: {
      id: 't1',
      timestamp_time: '2026-06-29T00:00:00.000Z',
      tsa_authority: 'TÜBİTAK KAMU SM',
      file_sha256: 'a'.repeat(64),
      verify_url: 'https://imzala.org/dogrula?seri=t1',
      certificate_url: 'https://imzala.org/dogrula?seri=t1',
      credits_used: 4,
      credits_remaining: 6,
    },
  };
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(okTs), { status: 201 }),
  );
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  const r = await c.createTimestamp({
    fileBuffer: Buffer.from('hi'),
    fileName: 'a.pdf',
    idempotencyKey: 'k1',
  });
  expect(r.verify_url).toContain('?seri=t1');
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as any)['Idempotency-Key']).toBe('k1');
  expect(init.body).toBeInstanceOf(FormData);
});

test('non-JSON error body maps to ImzalaApiError without throwing parse error', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response('Service Unavailable', { status: 503 }),
  );
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await expect(c.getMe()).rejects.toMatchObject({
    status: 503,
    code: undefined,
    message: 'HTTP 503',
  });
  await expect(c.getMe()).rejects.toBeInstanceOf(ImzalaApiError);
});
