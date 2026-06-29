import { describe, test, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from '../server.js';

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

  test('registers exactly two tools: whoami and eser_tescil', () => {
    const server = createServer(makeTestOpts('imz_x'));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const names = Object.keys(tools).sort();
    expect(names).toEqual(['eser_tescil', 'whoami']);
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
    const result = await tools['eser_tescil'].handler({ file_name: 'test.pdf' }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('whoami handler with valid apiKey returns stub text without isError', async () => {
    const fetchSpy = vi.fn();
    const server = createServer({
      getAuthContext: () => ({ apiKey: 'imz_test' }),
      baseUrl: 'https://test-api.imzala.org',
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('not yet implemented');
    // Stub does NOT call the API — resolveClient builds a client but handler doesn't invoke it
    expect(fetchSpy).not.toHaveBeenCalled();
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
