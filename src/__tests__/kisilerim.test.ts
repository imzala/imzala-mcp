import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatContactList } from '../format.js';

const LIST = {
  contacts: [
    { id: 'c1', first_name: 'Ahmet', last_name: 'Yılmaz', email: 'ahmet@x.com', phone: '+905321112233', job_title: 'Genel Müdür', company_id: 'co1', company: { id: 'co1', name: 'Acme A.Ş.' }, notes: null, address_country: 'TR', address_city: 'İstanbul', address_district: 'Kadıköy', address_line: 'X sok', archived_at: null, created_at: '2026-06-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' },
    { id: 'c2', first_name: 'Zeynep', last_name: 'Kaya', email: null, phone: '+905339998877', job_title: null, company_id: null, company: null, notes: null, address_country: null, address_city: null, address_district: null, address_line: null, archived_at: null, created_at: '2026-06-02T00:00:00.000Z', updated_at: '2026-06-02T00:00:00.000Z' },
  ],
  total: 2, page: 1, limit: 20,
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('listContacts', () => {
  test('GETs /api/v1/contacts with default page & limit', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listContacts();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/contacts?page=1&limit=20');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
  });

  test('threads q + page + limit', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listContacts({ q: 'ahmet', page: 3, limit: 10 });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('page=3');
    expect(url).toContain('limit=10');
    expect(url).toContain('q=ahmet');
  });
});

describe('formatContactList', () => {
  test('lists contacts with name + contact bits, no TC ever', () => {
    const out = formatContactList(LIST as never);
    expect(out).toContain('Ahmet Yılmaz');
    expect(out).toContain('c1');
    expect(out).toContain('ahmet@x.com');
    expect(out).toContain('Acme A.Ş.');
    expect(out).toContain('Zeynep Kaya');
    expect(out).toContain('Toplam: 2');
    // The v1 API allowlist has no government_id; nothing TC-shaped should appear.
    expect(out).not.toMatch(/\b\d{11}\b/);
    expect(out).not.toMatch(/kimlik|T\.?C\.?/i);
  });

  test('empty list', () => {
    const out = formatContactList({ contacts: [], total: 0, page: 1, limit: 20 } as never);
    expect(out).toContain('Hiç kişi bulunamadı');
  });
});
