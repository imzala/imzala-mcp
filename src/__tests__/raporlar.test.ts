import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatReports } from '../format.js';

const REPORT = {
  contracts: { total: 12, pending: 3, completed: 7, cancelled: 1, expired: 1, this_month: 4 },
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('getReports', () => {
  test('GETs /api/v1/reports with X-API-Key', async () => {
    const fetchFn = mockFetchOk({ success: true, data: REPORT });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const r = await c.getReports();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/reports');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
    expect(r.contracts.total).toBe(12);
  });
});

describe('formatReports', () => {
  test('renders Turkish contract summary (counts only, no PII)', () => {
    const out = formatReports(REPORT as never);
    expect(out).toContain('Toplam sözleşme: 12');
    expect(out).toContain('Bekleyen (imza sürecinde): 3');
    expect(out).toContain('Tamamlanan: 7');
    expect(out).toContain('İptal edilen: 1');
    expect(out).toContain('Süresi dolmuş: 1');
    expect(out).toContain('Bu ay oluşturulan: 4');
    expect(out).not.toContain('—');
  });

  test('zero counts', () => {
    const out = formatReports({ contracts: { total: 0, pending: 0, completed: 0, cancelled: 0, expired: 0, this_month: 0 } } as never);
    expect(out).toContain('Toplam sözleşme: 0');
  });
});
