import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatCreateDemand } from '../format.js';

const RESULT = {
  id: 'dem_1', title: 'Kira Sözleşmesi', status: 'PENDING', template_id: 't1',
  signing_urls: [{ party_id: 'p1', first_name: 'Ahmet', last_name: 'Yılmaz', email: 'a@x.com', phone: null, signing_url: 'https://e.imzala.org/imza/p1' }],
  result_url: 'https://e.imzala.org/sonuc/dem_1',
  variables_applied: ['kira_bedeli'], dispatched: 0,
};
function okFetch(body: unknown) { return vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => body }); }

describe('createDemand', () => {
  test('POSTs /api/v1/demands with dispatch_notifications:false by default (create-only)', async () => {
    const fetchFn = okFetch({ success: true, data: RESULT });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({ templateId: 't1', partyMapping: [{ template_party_id: 'tp1', first_name: 'Ahmet', last_name: 'Yılmaz', email: 'a@x.com' }], send: false });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands');
    const sent = JSON.parse(opts.body as string);
    expect(sent.dispatch_notifications).toBe(false); // create-only default
    expect(sent.template_id).toBe('t1');
    expect(opts.headers['X-API-Key']).toBe('imz_x');
  });

  test('send:true omits dispatch_notifications (API default = send)', async () => {
    const fetchFn = okFetch({ success: true, data: { ...RESULT, dispatched: 1 } });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({ templateId: 't1', partyMapping: [{ template_party_id: 'tp1', first_name: 'A', last_name: 'B', email: 'a@x.com' }], send: true });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.dispatch_notifications).toBeUndefined();
  });

  test('sends Idempotency-Key header when provided', async () => {
    const fetchFn = okFetch({ success: true, data: RESULT });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({ templateId: 't1', partyMapping: [{ template_party_id: 'tp1', first_name: 'A', last_name: 'B', email: 'a@x.com' }], send: false, idempotencyKey: 'abc' });
    expect(fetchFn.mock.calls[0][1].headers['Idempotency-Key']).toBe('abc');
  });

  test('throws ImzalaApiError on 402 insufficient credits', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ error: 'Yetersiz kredi', code: 'INSUFFICIENT_CREDITS' }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.createDemand({ templateId: 't1', partyMapping: [{ template_party_id: 'tp1', first_name: 'A', last_name: 'B', email: 'a@x.com' }], send: false })).rejects.toMatchObject({ status: 402, code: 'INSUFFICIENT_CREDITS' });
  });
});

describe('formatCreateDemand', () => {
  test('create-only: shows signing urls + not-sent notice + credit', () => {
    const out = formatCreateDemand(RESULT as never, false);
    expect(out).toContain('Kira Sözleşmesi');
    expect(out).toContain('https://e.imzala.org/imza/p1');
    expect(out).toMatch(/gönderilmedi|iletmediniz|siz iletin/i);
    expect(out).toContain('1 kredi');
  });
  test('sent: shows dispatched count', () => {
    const out = formatCreateDemand({ ...RESULT, dispatched: 1 } as never, true);
    expect(out).toMatch(/gönderildi|1 davet/i);
  });
});
