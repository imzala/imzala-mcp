import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatDeleteDemand } from '../format.js';
import { ImzalaApiError } from '../client.js';
import { createServer } from '../server.js';

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

describe('deleteDemand', () => {
  test('DELETEs /api/v1/demands/:id with X-API-Key', async () => {
    const fetchFn = okFetch({ success: true, data: { id: 'd1', deleted: true } });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const r = await c.deleteDemand('d1');
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands/d1');
    expect(opts.method).toBe('DELETE');
    expect(opts.headers['X-API-Key']).toBe('imz_x');
    expect(r).toEqual({ id: 'd1', deleted: true });
  });

  test('throws ImzalaApiError on 409 (completed cannot be deleted)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ success: false, error: 'Tamamlanmış sözleşme API üzerinden silinemez', code: 'DEMAND_COMPLETED' }),
    });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.deleteDemand('d1')).rejects.toBeInstanceOf(ImzalaApiError);
    await expect(c.deleteDemand('d1')).rejects.toMatchObject({ status: 409, code: 'DEMAND_COMPLETED' });
  });
});

describe('formatDeleteDemand', () => {
  test('confirms permanent deletion + irreversible warning', () => {
    const out = formatDeleteDemand({ id: 'd1', deleted: true });
    expect(out).toContain('kalıcı olarak silindi');
    expect(out).toContain('d1');
    expect(out).toMatch(/geri ALINAMAZ/i);
    expect(out).not.toContain('—');
  });
});

describe('sozlesme_sil tool', () => {
  test('registered with destructive-confirm + iptal-distinction in description', () => {
    const server = createServer({
      getAuthContext: () => ({ apiKey: 'imz_x' }),
      baseUrl: 'https://test-api.imzala.org',
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const tools = (server as unknown as PrivateServer)._registeredTools;
    expect(tools['sozlesme_sil']).toBeDefined();
    const d = tools['sozlesme_sil'].description ?? '';
    expect(d).toMatch(/KALICI|hard delete/i);
    expect(d).toMatch(/GERİ ALINAMAZ|DÖNÜŞÜ OLMAYACAK/i);
    expect(d).toContain('sozlesme_iptal'); // steers to cancel as the softer option
    expect(d).toMatch(/onay/i); // requires explicit user confirmation before the destructive call
    expect(d).not.toContain('—');
  });
});
