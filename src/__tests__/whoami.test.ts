import { describe, test, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWhoami, type ResolveClient } from '../tools/whoami.js';
import { ImzalaApiError, type MeResult, type makeClient } from '../client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { handler: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

const testMe: MeResult = {
  id: 'u1',
  email: 'demo@imzala.org',
  first_name: 'Ali',
  last_name: 'Veli',
  workspace: { type: 'personal', organization_id: null },
  credits: { remaining: 12 },
};

function makeResolveWithClient(
  getMe: () => Promise<MeResult>,
): ResolveClient {
  const client = { getMe } as unknown as ReturnType<typeof makeClient>;
  return async () => ({ client });
}

function makeResolveWithError(errorText: string): ResolveClient {
  return async () => ({ errorText });
}

describe('whoami handler', () => {
  test('successful getMe: result text contains email', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithClient(async () => testMe));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('demo@imzala.org');
  });

  test('successful getMe: result text contains "Kişisel"', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithClient(async () => testMe));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.content[0].text).toContain('Kişisel');
  });

  test('successful getMe for org workspace: result contains "Organizasyon"', async () => {
    const orgMe: MeResult = { ...testMe, workspace: { type: 'organization', organization_id: 'org-42' } };
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithClient(async () => orgMe));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.content[0].text).toContain('Organizasyon');
  });

  test('ImzalaApiError 401: isError=true and mentions IMZALA_API_KEY', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithClient(async () => {
      throw new ImzalaApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('missing API key (resolveClient returns errorText): isError=true', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithError('IMZALA_API_KEY ayarlı değil, kurulum için README sayfasına bakın.'));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });

  test('network error: isError=true and mentions ulaşılamadı', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWhoami(server, makeResolveWithClient(async () => {
      throw new TypeError('fetch failed');
    }));
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const result = await tools['whoami'].handler({}, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ulaşılamadı');
  });
});
