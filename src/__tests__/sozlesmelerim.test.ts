import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatDemandList } from '../format.js';

const LIST = {
  demands: [
    { id: 'd1', title: 'Kira Sözleşmesi', status: 'PENDING', created_at: '2026-07-01T10:00:00.000Z', completed_at: null, parties_total: 2, parties_signed: 1, pdf_url: null },
    { id: 'd2', title: 'Hizmet Sözleşmesi', status: 'COMPLETED', created_at: '2026-06-20T09:00:00.000Z', completed_at: '2026-06-21T09:00:00.000Z', parties_total: 2, parties_signed: 2, pdf_url: 'https://api-prd.imzala.org/sonuc/d2/pdf' },
  ],
  total: 2, page: 1, limit: 20,
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('listDemands', () => {
  test('GETs /api/v1/demands with default page & limit when no input', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listDemands();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands?page=1&limit=20');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
  });

  test('threads status + q + page + limit into the query string', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listDemands({ status: 'COMPLETED', q: 'kira sözleşmesi', page: 2, limit: 50 });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=50');
    expect(url).toContain('status=COMPLETED');
    // q is URL-encoded (space + Turkish char)
    expect(url).toContain('q=kira+s%C3%B6zle%C5%9Fmesi');
  });

  test('threads from + to date range into the query string', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listDemands({ from: '2026-06-01', to: '2026-06-30' });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('from=2026-06-01');
    expect(url).toContain('to=2026-06-30');
  });

  test('throws ImzalaApiError on 403 insufficient scope', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'no scope', code: 'INSUFFICIENT_SCOPE' }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.listDemands()).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_SCOPE' });
  });
});

describe('formatDemandList', () => {
  test('lists demands with Turkish status + signed count, no bearer link', () => {
    const out = formatDemandList(LIST as never);
    expect(out).toContain('Kira Sözleşmesi');
    expect(out).toContain('d1');
    expect(out).toContain('Bekliyor');
    expect(out).toContain('1/2 taraf imzaladı');
    expect(out).toContain('Tamamlandı');
    expect(out).toContain('Toplam: 2');
    // completed item exposes its public result-page pdf, but never an /imza/ bearer link
    expect(out).toContain('https://api-prd.imzala.org/sonuc/d2/pdf');
    expect(out).not.toContain('/imza/');
  });

  test('empty list', () => {
    const out = formatDemandList({ demands: [], total: 0, page: 1, limit: 20 } as never);
    expect(out).toContain('Hiç sözleşme bulunamadı');
  });
});
