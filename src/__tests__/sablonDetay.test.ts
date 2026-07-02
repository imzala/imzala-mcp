import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatTemplateDetail } from '../format.js';

const DETAIL = {
  id: 't1', name: 'Kira Sözleşmesi', description: 'Konut kirası', category: 'Emlak', usage_count: 12,
  parties: [{ id: 'tp1', order: 0, label: 'Kiraya Veren', is_required: true }, { id: 'tp2', order: 1, label: 'Kiracı', is_required: true }],
  pages_count: 3,
  variables: [
    { slug: 'kira_bedeli', label: 'Kira Bedeli', item_type: 'dynamic_text', is_required: true, default_source: null },
    { slug: 'baslangic', label: 'Başlangıç Tarihi', item_type: 'date', is_required: true, default_source: 'current.date' },
  ],
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('getTemplate', () => {
  test('GETs /api/v1/templates/:id and url-encodes id', async () => {
    const fetchFn = mockFetchOk({ success: true, data: DETAIL });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.getTemplate('t 1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api-prd.imzala.org/api/v1/templates/t%201',
      { method: 'GET', headers: { 'X-API-Key': 'imz_x' } },
    );
  });
});

describe('formatTemplateDetail', () => {
  test('shows parties and variable catalog', () => {
    const out = formatTemplateDetail(DETAIL as never);
    expect(out).toContain('Kira Sözleşmesi');
    expect(out).toContain('Kiraya Veren');
    expect(out).toContain('kira_bedeli');
    expect(out).toMatch(/kira_bedeli.*zorunlu/s);
    expect(out).toContain('3 sayfa');
  });

  test('no variables', () => {
    const out = formatTemplateDetail({ ...DETAIL, variables: [] } as never);
    expect(out).toContain('doldurulabilir değişken yok');
  });
});
