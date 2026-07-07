import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatCancelDemand, formatError } from '../format.js';
import { ImzalaApiError } from '../client.js';
import { createServer } from '../server.js';

const RESULT = {
  id: 'd1', title: 'Kira Sözleşmesi', status: 'CANCELLED',
  cancelled_at: '2026-07-07T12:00:00.000Z', cancellation_reason: 'Müşteri vazgeçti',
};
function okFetch(body: unknown) { return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

describe('cancelDemand', () => {
  test('POSTs /api/v1/demands/:id/cancel with reason', async () => {
    const fetchFn = okFetch({ success: true, data: RESULT });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.cancelDemand('d1', 'Müşteri vazgeçti');
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands/d1/cancel');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-API-Key']).toBe('imz_x');
    expect(JSON.parse(opts.body as string)).toEqual({ reason: 'Müşteri vazgeçti' });
  });

  test('omits reason from body when not provided', async () => {
    const fetchFn = okFetch({ success: true, data: { ...RESULT, cancellation_reason: null } });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.cancelDemand('d1');
    expect(JSON.parse(fetchFn.mock.calls[0][1].body as string)).toEqual({});
  });

  test('throws ImzalaApiError on 409 (already completed/cancelled)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Tamamlanmış sözleşme iptal edilemez' }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.cancelDemand('d1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('formatCancelDemand', () => {
  test('states cancellation + platform-not-legal-fesih + irreversibility', () => {
    const out = formatCancelDemand(RESULT as never);
    expect(out).toContain('İptal edildi');
    expect(out).toContain('Kira Sözleşmesi');
    expect(out).toContain('İptal edildi'); // status → İptal edildi
    expect(out).toContain('Müşteri vazgeçti');
    expect(out).toMatch(/platform işlemi/);
    expect(out).toMatch(/feshi değildir|feshi değildir/);
    expect(out).toMatch(/geri alınamaz/);
    // never an em dash (AI-signature / house style)
    expect(out).not.toContain('—');
  });

  test('shows refunded credit only when backend refunded (bulk)', () => {
    const withRefund = formatCancelDemand({ ...RESULT, refunded: 3 } as never);
    expect(withRefund).toContain('İade edilen kredi: 3');
    const noRefund = formatCancelDemand({ ...RESULT, refunded: 0 } as never);
    expect(noRefund).not.toContain('İade edilen kredi');
  });
});

describe('formatError — cancel conflict', () => {
  test('409 (no code) maps to a curated non-sensitive Turkish message', () => {
    const out = formatError(new ImzalaApiError(409, undefined, 'Tamamlanmış sözleşme iptal edilemez'));
    expect(out).toMatch(/mevcut durumunda yapılamaz/);
    // must NOT echo the raw backend message verbatim as the whole output
    expect(out).toMatch(/sozlesme_durumu/);
  });
});

describe('sozlesme_iptal tool description (LEGAL review surface)', () => {
  const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
  const desc = (server as unknown as PrivateServer)._registeredTools['sozlesme_iptal'].description ?? '';

  test('(a) states the action is terminal + irreversible', () => {
    expect(desc).toMatch(/KESİN/);
    expect(desc).toMatch(/GERİ ALINAMAZ|geri alınamaz/);
  });
  test('(b) instructs the AI to require explicit user consent', () => {
    expect(desc).toMatch(/Yapay zeka asistanına/);
    expect(desc).toMatch(/AÇIK onay/);
    expect(desc).toMatch(/onay al/);
  });
  test('(c) disambiguation: verify via sozlesme_durumu + warn if a party already signed', () => {
    expect(desc).toMatch(/sozlesme_durumu/);
    expect(desc).toMatch(/DOĞRULA/);
    expect(desc).toMatch(/İMZALADIYSA/);
    expect(desc).toMatch(/UYAR/);
  });
  test('(d) does NOT present the action as a legal "fesih"', () => {
    expect(desc).toMatch(/platform iptali/);
    expect(desc).toMatch(/fesih.*DEĞİLDİR|feshi.*DEĞİLDİR|DEĞİLDİR/);
  });
  test('house style: no em dash', () => {
    expect(desc).not.toContain('—');
  });
});
