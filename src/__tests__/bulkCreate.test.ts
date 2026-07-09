import { test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatBulkResult } from '../format.js';

const okBulk = {
  success: true,
  data: {
    template_id: 't',
    total: 2,
    created: 1,
    failed: 1,
    results: [
      {
        row_index: 0,
        status: 'created',
        demand_id: 'd1',
        signing_urls: [{ first_name: 'Ali', last_name: 'Y', signing_url: 'https://e.imzala.org/imza/p1' }],
      },
      { row_index: 1, status: 'failed', error: 'INSUFFICIENT_CREDITS', message: 'yetersiz' },
    ],
  },
};

test('bulkCreateDemands POST /demands/bulk çağırır, BulkResult döner', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(okBulk), { status: 200 }),
  );
  const c = makeClient({ apiKey: 'imz_k', baseUrl: 'https://api', fetch: fetchMock as any });

  const r = await c.bulkCreateDemands({ template_id: 't', rows: [{ party_mapping: [] }, { party_mapping: [] }] });

  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe('https://api/api/v1/demands/bulk');
  expect(init.method).toBe('POST');
  expect((init.headers as any)['X-API-Key']).toBe('imz_k');
  expect((init.headers as any)['Content-Type']).toBe('application/json');
  expect(r.created).toBe(1);
  expect(r.results).toHaveLength(2);
});

test('bulkCreateDemands X-Workspace-Id header opsiyonel gönderilir', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(okBulk), { status: 200 }),
  );
  const c = makeClient({ apiKey: 'imz_k', baseUrl: 'https://api', fetch: fetchMock as any });

  await c.bulkCreateDemands({ template_id: 't', rows: [{ party_mapping: [] }] }, 'org_1');

  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as any)['X-Workspace-Id']).toBe('org_1');
});

test('success:false → ImzalaApiError, mesaj json.message öncelikli', async () => {
  const body = { success: false, message: 'Şablon bulunamadı', error: 'not_found', code: 'TEMPLATE_NOT_FOUND' };
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  );
  const c = makeClient({ apiKey: 'imz_k', baseUrl: 'https://api', fetch: fetchMock as any });

  await expect(
    c.bulkCreateDemands({ template_id: 'bad', rows: [{ party_mapping: [] }] }),
  ).rejects.toMatchObject({ status: 200, code: 'TEMPLATE_NOT_FOUND', message: 'Şablon bulunamadı' });
});

test('formatBulkResult — özet, imza-linki SIZMAZ, sonuç-linki görünür, em-dash yok', () => {
  const out = formatBulkResult({ template_id: 't', total: 2, created: 1, failed: 1, results: [
    { row_index: 0, status: 'created', demand_id: 'd1', result_url: 'https://e.imzala.org/sonuc/d1', signing_urls: [{ first_name: 'Ali', last_name: 'Y', signing_url: 'https://e.imzala.org/imza/p1' }] },
    { row_index: 1, status: 'failed', error: 'INSUFFICIENT_CREDITS', message: 'yetersiz' } ] });
  expect(out).toContain("2 sözleşmeden 1'i oluşturuldu");
  // SECURITY: signing_url (bearer link) must NOT leak to the AI provider
  expect(out).not.toContain('imza/p1');
  expect(out).not.toContain('/imza/');
  // party name + PUBLIC result page are fine
  expect(out).toContain('Ali Y');
  expect(out).toContain('https://e.imzala.org/sonuc/d1');
  expect(out).toContain('yetersiz');
  expect(out).not.toContain('—');
});
