import { describe, test, expect, vi, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, rm } from 'fs/promises';
import { makeClient } from '../client.js';

const PDF = Buffer.from('%PDF-1.4 fake certificate', 'utf8');

function mockFetchPdf() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => PDF });
}
function mockFetchErr(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: false, status, json: async () => body, text: async () => JSON.stringify(body) });
}

describe('downloadCertificate', () => {
  test('GETs /api/v1/demands/:id/certificate with X-API-Key, returns Buffer', async () => {
    const fetchFn = mockFetchPdf();
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const buf = await c.downloadCertificate('dmd 9/z');
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands/dmd%209%2Fz/certificate');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
    expect(buf.equals(PDF)).toBe(true);
  });

  test('409 (not completed) throws (surfaces to formatError)', async () => {
    const fetchFn = mockFetchErr(409, { success: false, error: 'Sertifika yalnızca tamamlanmış sözleşmeler için üretilir' });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.downloadCertificate('d1')).rejects.toBeDefined();
  });
});

describe('sozlesme_sertifikasi tool', () => {
  const paths: string[] = [];
  afterEach(async () => { for (const p of paths) await rm(p, { force: true }); paths.length = 0; });

  function makeServer(fetchFn: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return import('../server.js').then(({ createServer }) => createServer({
      getAuthContext: () => ({ apiKey: 'imz_x' }),
      baseUrl: 'https://api-prd.imzala.org',
      fetch: fetchFn as typeof fetch,
    }));
  }

  test('save_path verilince dosyaya yazar', async () => {
    const server = await makeServer(mockFetchPdf());
    const tools = (server as unknown as { _registeredTools: Record<string, { handler: (a: unknown, e: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }> }> })._registeredTools;
    const out = join(tmpdir(), `cert-${Date.now()}.pdf`);
    paths.push(out);
    const res = await tools['sozlesme_sertifikasi'].handler({ demand_id: 'd1', save_path: out }, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('kaydedildi');
    expect((await readFile(out)).equals(PDF)).toBe(true);
  });

  test('save_path yoksa base64 döner', async () => {
    const server = await makeServer(mockFetchPdf());
    const tools = (server as unknown as { _registeredTools: Record<string, { handler: (a: unknown, e: unknown) => Promise<{ content: { text: string }[] }> }> })._registeredTools;
    const res = await tools['sozlesme_sertifikasi'].handler({ demand_id: 'd1' }, {});
    expect(res.content[0].text).toContain('base64');
    expect(res.content[0].text).toContain(PDF.toString('base64'));
  });
});
