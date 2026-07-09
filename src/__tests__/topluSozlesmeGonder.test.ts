import { describe, test, expect, vi } from 'vitest';
import { z } from 'zod';
import { topluSozlesmeGonderInputSchema } from '../tools/topluSozlesmeGonder.js';
import { createServer } from '../server.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string; handler: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

function makeTestOpts(apiKey?: string, fetchImpl?: typeof fetch) {
  return {
    getAuthContext: () => ({ apiKey }),
    baseUrl: 'https://test-api.imzala.org',
    fetch: (fetchImpl ?? vi.fn()) as unknown as typeof fetch,
  };
}

const oneRow = { party_mapping: [{ template_party_id: 'tp1', first_name: 'A', last_name: 'B', email: 'a@x.com' }] };

describe('toplu_sozlesme_gonder input schema', () => {
  const schema = z.object(topluSozlesmeGonderInputSchema);

  test('accepts 1..10 rows', () => {
    const parsed = schema.safeParse({ template_id: 't1', rows: Array(10).fill(oneRow) });
    expect(parsed.success).toBe(true);
  });

  test('rejects 11 rows (max 10)', () => {
    const parsed = schema.safeParse({ template_id: 't1', rows: Array(11).fill(oneRow) });
    expect(parsed.success).toBe(false);
  });

  test('rejects 0 rows (min 1)', () => {
    const parsed = schema.safeParse({ template_id: 't1', rows: [] });
    expect(parsed.success).toBe(false);
  });

  test('options is optional', () => {
    const parsed = schema.safeParse({ template_id: 't1', rows: [oneRow] });
    expect(parsed.success).toBe(true);
  });
});

describe('toplu_sozlesme_gonder tool', () => {
  test('handler with no apiKey returns isError tool result (does not throw)', async () => {
    const server = createServer(makeTestOpts());
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['toplu_sozlesme_gonder'].handler({ template_id: 't1', rows: [oneRow] }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('handler with valid apiKey calls bulkCreateDemands and returns formatBulkResult text', async () => {
    const okBody = {
      success: true,
      data: {
        template_id: 't1',
        total: 1,
        created: 1,
        failed: 0,
        results: [
          {
            row_index: 0,
            status: 'created',
            demand_id: 'd1',
            result_url: 'https://e.imzala.org/sonuc/d1',
            signing_urls: [{ first_name: 'A', last_name: 'B', signing_url: 'https://e.imzala.org/imza/p1' }],
          },
        ],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    const server = createServer(makeTestOpts('imz_x', fetchMock as unknown as typeof fetch));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['toplu_sozlesme_gonder'].handler({ template_id: 't1', rows: [oneRow] }, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("1 sözleşmeden 1'i oluşturuldu");
    // SECURITY: bearer signing link must NOT reach the AI provider; public result page is fine
    expect(result.content[0].text).not.toContain('/imza/');
    expect(result.content[0].text).toContain('https://e.imzala.org/sonuc/d1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://test-api.imzala.org/api/v1/demands/bulk');
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.template_id).toBe('t1');
    expect(sentBody.rows).toHaveLength(1);
  });

  test('handler maps API errors via formatError (does not throw)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Şablon bulunamadı', code: 'TEMPLATE_NOT_FOUND' }), { status: 200 }),
    );
    const server = createServer(makeTestOpts('imz_x', fetchMock as unknown as typeof fetch));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['toplu_sozlesme_gonder'].handler({ template_id: 'bad', rows: [oneRow] }, {});
    expect(result.isError).toBe(true);
  });
});

describe('toplu_sozlesme_gonder tool description', () => {
  const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
  const desc = (server as unknown as PrivateServer)._registeredTools['toplu_sozlesme_gonder'].description ?? '';

  test('mentions the 10-recipient limit and sablon_detay, no em-dash', () => {
    expect(desc).toMatch(/10/);
    expect(desc).toMatch(/sablon_detay/);
    expect(desc).not.toContain('—');
  });
});
