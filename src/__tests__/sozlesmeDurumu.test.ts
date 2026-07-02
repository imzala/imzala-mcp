import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatContractStatus } from '../format.js';

const DEMAND = {
  id: 'dem_1',
  title: 'Kira Sözleşmesi',
  status: 'PENDING',
  created_at: '2026-07-01T10:00:00.000Z',
  completed_at: null,
  parties: [
    { party_id: 'p1', first_name: 'Ahmet', last_name: 'Yılmaz', email: 'a@x.com', signed: false, signed_at: '2026-07-01T12:00:00.000Z', signing_url: 'https://e.imzala.org/imza/p1' },
    { party_id: 'p2', first_name: 'Ayşe', last_name: 'Demir', email: 'b@x.com', signed: false, signed_at: null, signing_url: 'https://e.imzala.org/imza/p2' },
  ],
  result_url: 'https://e.imzala.org/sonuc/dem_1',
  pdf_url: null,
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('getDemand', () => {
  test('GETs /api/v1/demands/:id with X-API-Key and unwraps data', async () => {
    const fetchFn = mockFetchOk({ success: true, data: DEMAND });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const res = await c.getDemand('dem_1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api-prd.imzala.org/api/v1/demands/dem_1',
      { method: 'GET', headers: { 'X-API-Key': 'imz_x' } },
    );
    expect(res.title).toBe('Kira Sözleşmesi');
    expect(res.parties).toHaveLength(2);
  });

  test('throws ImzalaApiError on non-ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Sözleşme bulunamadı', code: 'NOT_FOUND' }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.getDemand('missing')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('formatContractStatus', () => {
  test('derives signed from signed_at (NOT the buggy signed boolean)', () => {
    const out = formatContractStatus(DEMAND as never);
    // p1 has signed_at → imzaladı; p2 has null → bekliyor. Backend `signed:false` on both is ignored.
    expect(out).toContain('Ahmet Yılmaz');
    expect(out).toMatch(/Ahmet Yılmaz.*imzaladı/s);
    expect(out).toMatch(/Ayşe Demir.*bekliyor/s);
    expect(out).toContain('Bekliyor'); // status TR
  });

  test('does NOT leak the signing_url bearer link into output', () => {
    // signing_url is a no-extra-auth bearer link; it must not flow to the AI provider.
    const out = formatContractStatus(DEMAND as never);
    expect(out).not.toContain('imza/p2');
    expect(out).not.toContain('imza linki');
  });

  test('includes the neutral non-legal-proof disclaimer footer', () => {
    const out = formatContractStatus(DEMAND as never);
    expect(out).toContain('ispat teşkil etmez');
  });

  test('shows PDF link when completed', () => {
    const completed = { ...DEMAND, status: 'COMPLETED', pdf_url: 'https://api-prd.imzala.org/sonuc/dem_1/pdf' };
    expect(formatContractStatus(completed as never)).toContain('https://api-prd.imzala.org/sonuc/dem_1/pdf');
  });
});
