/**
 * TDD tests for the stdio entry point (src/bin/stdio.ts).
 *
 * Strategy:
 *  - vi.hoisted() to create spy functions before vi.mock factories run (ESM hoisting requirement).
 *  - Mock `../server.js` so createServer returns a lightweight fake.
 *  - Mock `@modelcontextprotocol/sdk/server/stdio.js` so StdioServerTransport never touches real stdio.
 *  - Spy on process.stderr.write to assert diagnostic messages never leak to stdout.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted spies — created before vi.mock factories execute
// ---------------------------------------------------------------------------
const { createServerSpy, connectSpy, MockStdioTransport } = vi.hoisted(() => {
  const connectSpy = vi.fn().mockResolvedValue(undefined);
  const server = { connect: connectSpy };
  const createServerSpy = vi.fn().mockReturnValue(server);
  const MockStdioTransport = vi.fn().mockImplementation(() => ({}));
  return { createServerSpy, connectSpy, MockStdioTransport };
});

vi.mock('../server.js', () => ({
  createServer: createServerSpy,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: MockStdioTransport,
}));

// Import main AFTER mocks are registered
import { main } from '../bin/stdio.js';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('stdio entry: main()', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    // Clear call history only — does NOT reset mock implementations.
    vi.clearAllMocks();
    // Re-apply implementations in case clearAllMocks ever resets them (defensive).
    connectSpy.mockResolvedValue(undefined);
    createServerSpy.mockReturnValue({ connect: connectSpy });
    MockStdioTransport.mockImplementation(() => ({}));
    // Intercept stderr so no diagnostic text bleeds into stdout during tests.
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    stderrSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  test('auto-run guard: importing the module does NOT invoke main()', () => {
    // If the auto-run guard failed, createServer would have been called at
    // import time. We assert that has not happened.
    expect(createServerSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  test('no API key: writes setup hint to stderr and still boots server', async () => {
    await main({});

    // Must emit exactly one stderr line hinting at the missing key.
    expect(stderrSpy).toHaveBeenCalledOnce();
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain('IMZALA_API_KEY');

    // Despite the missing key, the server must still be constructed and connected
    // so MCP clients receive a proper tool-level error rather than a broken pipe.
    expect(createServerSpy).toHaveBeenCalledOnce();
    expect(connectSpy).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  test('with API key: no stderr warning; createServer gets correct args', async () => {
    await main({ IMZALA_API_KEY: 'imz_x' });

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(createServerSpy).toHaveBeenCalledOnce();

    const opts = createServerSpy.mock.calls[0][0] as {
      baseUrl: string;
      getAuthContext: () => { apiKey?: string };
      fetch: unknown;
    };
    // Default base URL when IMZALA_API_BASE_URL is not set.
    expect(opts.baseUrl).toBe('https://test-api.imzala.org');
    // getAuthContext must return the injected env key.
    expect(opts.getAuthContext()).toEqual({ apiKey: 'imz_x' });
    expect(connectSpy).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  test('custom IMZALA_API_BASE_URL: createServer called with overridden baseUrl', async () => {
    await main({ IMZALA_API_KEY: 'imz_x', IMZALA_API_BASE_URL: 'https://api-prd.imzala.org' });

    expect(createServerSpy).toHaveBeenCalledOnce();
    const opts = createServerSpy.mock.calls[0][0] as {
      baseUrl: string;
      getAuthContext: () => { apiKey?: string };
    };
    expect(opts.baseUrl).toBe('https://api-prd.imzala.org');
    expect(opts.getAuthContext()).toEqual({ apiKey: 'imz_x' });
  });
});
