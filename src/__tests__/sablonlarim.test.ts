import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatTemplateList } from '../format.js';

const LIST = {
  templates: [
    { id: 't1', name: 'Kira Sözleşmesi', description: 'Konut kirası', category: 'Emlak', usage_count: 12, parties: [{ id: 'tp1', order: 0, label: 'Kiraya Veren', is_required: true }, { id: 'tp2', order: 1, label: 'Kiracı', is_required: true }] },
  ],
  total: 1, page: 1, limit: 20,
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('listTemplates', () => {
  test('GETs /api/v1/templates with page & limit query', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listTemplates(2, 50);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api-prd.imzala.org/api/v1/templates?page=2&limit=50',
      { method: 'GET', headers: { 'X-API-Key': 'imz_x' } },
    );
  });

  test('defaults page=1 limit=20 when omitted', async () => {
    const fetchFn = mockFetchOk({ success: true, data: LIST });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.listTemplates();
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api-prd.imzala.org/api/v1/templates?page=1&limit=20',
      { method: 'GET', headers: { 'X-API-Key': 'imz_x' } },
    );
  });
});

describe('formatTemplateList', () => {
  test('lists templates with party count', () => {
    const out = formatTemplateList(LIST as never);
    expect(out).toContain('Kira Sözleşmesi');
    expect(out).toContain('t1');
    expect(out).toContain('2 taraf');
    expect(out).toContain('Toplam: 1');
  });

  test('empty list', () => {
    const out = formatTemplateList({ templates: [], total: 0, page: 1, limit: 20 } as never);
    expect(out).toContain('şablon bulunamadı');
  });
});
