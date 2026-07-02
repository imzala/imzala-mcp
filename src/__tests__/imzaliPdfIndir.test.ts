import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeClient } from '../client.js';

const PDF_BYTES = Buffer.from('%PDF-1.7 fake', 'utf8');

describe('downloadPdf', () => {
  test('fetches url and returns Buffer', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      arrayBuffer: async () => PDF_BYTES.buffer.slice(PDF_BYTES.byteOffset, PDF_BYTES.byteOffset + PDF_BYTES.byteLength),
    });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const buf = await c.downloadPdf('https://api-prd.imzala.org/sonuc/dem_1/pdf');
    expect(fetchFn).toHaveBeenCalledWith('https://api-prd.imzala.org/sonuc/dem_1/pdf', { method: 'GET' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8')).toContain('%PDF');
  });

  test('throws ImzalaApiError on non-ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 202, json: async () => ({ error: 'sealing_pending' }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.downloadPdf('https://api-prd.imzala.org/sonuc/dem_1/pdf')).rejects.toMatchObject({ status: 202 });
  });
});

import { createServer } from '../server.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { handler: (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

function serverWith(fetchImpl: unknown) {
  return createServer({
    getAuthContext: () => ({ apiKey: 'imz_x' }),
    baseUrl: 'https://api-prd.imzala.org',
    fetch: fetchImpl as typeof fetch,
  });
}

describe('imzali_pdf_indir tool', () => {
  test('returns error when demand not COMPLETED (pdf_url null)', async () => {
    const demand = { id: 'd1', title: 'X', status: 'PENDING', created_at: '', completed_at: null, parties: [], result_url: 'r', pdf_url: null };
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: demand }) });
    const s = serverWith(fetchFn) as unknown as PrivateServer;
    const out = await s._registeredTools['imzali_pdf_indir'].handler({ demand_id: 'd1' });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('tamamlanmadı');
  });

  test('returns base64 when completed and no save_path', async () => {
    const demand = { id: 'd1', title: 'X', status: 'COMPLETED', created_at: '', completed_at: '', parties: [], result_url: 'r', pdf_url: 'https://api-prd.imzala.org/sonuc/d1/pdf' };
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: demand }) })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => Buffer.from('%PDF-1.7', 'utf8').buffer });
    const s = serverWith(fetchFn) as unknown as PrivateServer;
    const out = await s._registeredTools['imzali_pdf_indir'].handler({ demand_id: 'd1' });
    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toMatch(/base64|JVBERi/); // JVBERi = %PDF in base64
  });
});
