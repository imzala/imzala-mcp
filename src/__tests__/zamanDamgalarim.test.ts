import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatTimestampList } from '../format.js';

const LIST = {
  timestamps: [
    { id: 'ts1', original_file_name: 'eser.pdf', original_file_size: 12345, timestamp_date: '2026-07-01T10:00:00.000Z', status: 'ACTIVE', description: 'Roman taslağı', created_at: '2026-07-01T10:00:00.000Z', timestamp_file_url: 'userId/ts1/eser.pdf.zd' },
    { id: 'ts2', original_file_name: 'sozlesme.pdf', original_file_size: null, timestamp_date: '2026-06-15T08:00:00.000Z', status: 'VERIFIED', description: null, created_at: '2026-06-15T08:00:00.000Z', timestamp_file_url: 'userId/ts2/sozlesme.pdf.zd' },
  ],
  total: 2, page: 1, limit: 20,
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('listTimestamps', () => {
  test('GETs /api/v1/timestamps with default page & limit', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listTimestamps();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/timestamps?page=1&limit=20');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
  });

  test('threads page + limit', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listTimestamps({ page: 4, limit: 5 });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('page=4');
    expect(url).toContain('limit=5');
  });
});

describe('formatTimestampList', () => {
  test('lists timestamps with Turkish status + damga date, no internal S3 key rendered', () => {
    const out = formatTimestampList(LIST as never);
    expect(out).toContain('eser.pdf');
    expect(out).toContain('ts1');
    expect(out).toContain('Aktif');
    expect(out).toContain('Roman taslağı');
    expect(out).toContain('Doğrulandı');
    expect(out).toContain('Toplam: 2');
    // never leak the internal storage key
    expect(out).not.toContain('.zd');
    expect(out).not.toContain('userId/');
  });

  test('empty list', () => {
    const out = formatTimestampList({ timestamps: [], total: 0, page: 1, limit: 20 } as never);
    expect(out).toContain('Hiç zaman damgası bulunamadı');
  });
});
