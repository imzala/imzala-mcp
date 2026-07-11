import { describe, test, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'module';
import { createServer, SERVER_VERSION } from '../server.js';

// SERVER_VERSION is a hardcoded constant (bundling constraints prevent a safe
// runtime package.json read). This test is the drift guard: it already bit
// once (v1.0.0 reported "0.1.0" in the MCP initialize handshake).
test('SERVER_VERSION matches package.json version', () => {
  const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };
  expect(SERVER_VERSION).toBe(pkg.version);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { handler: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

function makeTestOpts(apiKey?: string) {
  return {
    getAuthContext: () => ({ apiKey }),
    baseUrl: 'https://test-api.imzala.org',
    fetch: vi.fn() as unknown as typeof fetch,
  };
}

describe('createServer', () => {
  test('returns a McpServer instance', () => {
    const server = createServer(makeTestOpts('imz_x'));
    expect(server).toBeInstanceOf(McpServer);
  });

  test('registers exactly seventeen tools (16 + toplu_sozlesme_gonder)', () => {
    const server = createServer(makeTestOpts('imz_x'));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const names = Object.keys(tools).sort();
    expect(names).toEqual([
      'eser_tescil',
      'hatirlatma_gonder',
      'imzali_pdf_indir',
      'kisi_ekle',
      'kisilerim',
      'raporlar',
      'sablon_detay',
      'sablondan_sozlesme_olustur',
      'sablonlarim',
      'sozlesme_audit',
      'sozlesme_durumu',
      'sozlesme_iptal',
      'sozlesme_sertifikasi',
      'sozlesme_sil',
      'sozlesmelerim',
      'toplu_sozlesme_gonder',
      'whoami',
      'zaman_damgalarim',
    ]);
  });

  test('whoami handler with no apiKey returns isError tool result (does not throw)', async () => {
    const server = createServer(makeTestOpts()); // no apiKey
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('eser_tescil handler with no apiKey returns isError tool result (does not throw)', async () => {
    const server = createServer(makeTestOpts()); // no apiKey
    const tools = (server as unknown as PrivateServer)._registeredTools;
    // Provide valid file_base64 so input validation passes and auth check runs
    const validB64 = Buffer.from('hello').toString('base64'); // 'aGVsbG8='
    const result = await tools['eser_tescil'].handler({ file_base64: validB64, file_name: 'test.pdf' }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('whoami handler with valid apiKey calls getMe and returns formatted account info', async () => {
    const meData = {
      success: true,
      data: {
        id: 'u1',
        email: 'integration@imzala.org',
        first_name: 'Test',
        last_name: 'User',
        workspace: { type: 'personal', organization_id: null },
        credits: { remaining: 7 },
      },
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(meData), { status: 200 }),
    );
    const server = createServer({
      getAuthContext: () => ({ apiKey: 'imz_test' }),
      baseUrl: 'https://test-api.imzala.org',
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('integration@imzala.org');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  test('async getAuthContext is awaited: missing key yields isError', async () => {
    const server = createServer({
      getAuthContext: async () => {
        await Promise.resolve();
        return {};
      },
      baseUrl: 'https://x',
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBe(true);
  });
});
