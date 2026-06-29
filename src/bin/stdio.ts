/**
 * Stdio transport entry point for the Imzala MCP server.
 *
 * MCP protocol runs over stdin/stdout.
 * CRITICAL: stdout is the JSON-RPC channel — never write anything to it here.
 *           All diagnostics MUST go to stderr.
 *
 * Usage:
 *   IMZALA_API_KEY=imz_... node dist/bin/stdio.js
 *
 * Or via npx after publishing:
 *   npx @imzala/mcp-server
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import { createServer } from '../server.js';

/**
 * Bootstraps the MCP server and connects it to the stdio transport.
 *
 * @param env - Process environment map (defaults to `process.env`; injectable for testing).
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const apiKey = env.IMZALA_API_KEY;
  const baseUrl = env.IMZALA_API_BASE_URL ?? 'https://test-api.imzala.org';

  if (!apiKey) {
    // Warn to stderr — not stdout — because stdout is the MCP JSON-RPC channel.
    // We do NOT exit hard here: the server still boots so MCP clients receive a
    // proper tool-level error (isError=true) rather than a broken-pipe crash.
    process.stderr.write(
      "IMZALA_API_KEY ayarlı değil. Dashboard'dan 'timestamps' kapsamlı bir API anahtarı oluşturup MCP config'inize ekleyin (README).\n",
    );
  }

  const server = createServer({
    // getAuthContext is called on every tool invocation; we read from the
    // captured `env` so that tests can inject arbitrary values.
    getAuthContext: () => ({ apiKey: env.IMZALA_API_KEY }),
    baseUrl,
    fetch: globalThis.fetch,
  });

  await server.connect(new StdioServerTransport());
}

// ---------------------------------------------------------------------------
// Auto-run guard
// ---------------------------------------------------------------------------
// Only invoke main() when this file is the direct entry point (i.e. the
// process was started with `node dist/bin/stdio.js`). When the module is
// imported — e.g. in tests or by another script — this block is skipped.
function isMainModule(): boolean {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(msg + '\n');
    process.exit(1);
  });
}
