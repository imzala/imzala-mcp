import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { makeClient } from './client.js';
import { registerWhoami } from './tools/whoami.js';
import { registerEserTescil } from './tools/eserTescil.js';
import { registerSozlesmeDurumu } from './tools/sozlesmeDurumu.js';
import { registerSablonlarim } from './tools/sablonlarim.js';
import { registerSablonDetay } from './tools/sablonDetay.js';
import { registerImzaliPdfIndir } from './tools/imzaliPdfIndir.js';
import { registerSablondanSozlesme } from './tools/sablondanSozlesme.js';
import { registerHatirlatmaGonder } from './tools/hatirlatmaGonder.js';
import { registerSozlesmelerim } from './tools/sozlesmelerim.js';
import { registerSozlesmeIptal } from './tools/sozlesmeIptal.js';
import { registerKisilerim } from './tools/kisilerim.js';
import { registerKisiEkle } from './tools/kisiEkle.js';
import { registerZamanDamgalarim } from './tools/zamanDamgalarim.js';
import { registerSozlesmeAudit } from './tools/sozlesmeAudit.js';
import { registerSozlesmeSertifikasi } from './tools/sozlesmeSertifikasi.js';
import { registerRaporlar } from './tools/raporlar.js';
import { registerTopluSozlesmeGonder } from './tools/topluSozlesmeGonder.js';

export interface CreateServerOpts {
  /** Called on every tool invocation to obtain the current auth context. Must be cheap (reads env / header). */
  getAuthContext: () => { apiKey?: string } | Promise<{ apiKey?: string }>;
  /** Base URL of the Imzala API (e.g. https://api-prd.imzala.org). */
  baseUrl: string;
  /** Injected fetch implementation — allows mocking in tests and choosing the runtime fetch in prod. */
  fetch: typeof fetch;
}

/**
 * Creates and configures the Imzala MCP server.
 *
 * Design principles:
 * - Fully stateless: no module-level singletons, no in-memory session state.
 * - Auth is resolved per invocation via `getAuthContext`; the API client is
 *   constructed fresh on each tool call with the current credentials.
 * - Transport is NOT wired here (Task 6 — stdio); callers call
 *   `server.connect(transport)` themselves.
 */
// Reported to MCP clients in the initialize handshake.
// KEEP IN SYNC with package.json "version" on every release
// (enforced by a unit test in server.test.ts).
export const SERVER_VERSION = '1.7.1';

export function createServer(opts: CreateServerOpts): McpServer {
  const server = new McpServer({ name: 'imzala-mcp', version: SERVER_VERSION });

  /**
   * Resolves the current API client for a single tool invocation.
   *
   * Returns `{ errorText }` when the API key is missing so that tool handlers
   * can return a clean tool-error content block instead of throwing.
   */
  async function resolveClient(): Promise<{
    client?: ReturnType<typeof makeClient>;
    errorText?: string;
  }> {
    const { apiKey } = await opts.getAuthContext();
    if (!apiKey) {
      return { errorText: 'IMZALA_API_KEY ayarlı değil, kurulum için README sayfasına bakın.' };
    }
    return {
      client: makeClient({ apiKey, baseUrl: opts.baseUrl, fetch: opts.fetch }),
    };
  }

  registerWhoami(server, resolveClient);
  registerEserTescil(server, resolveClient);
  registerSozlesmeDurumu(server, resolveClient);
  registerSablonlarim(server, resolveClient);
  registerSablonDetay(server, resolveClient);
  registerImzaliPdfIndir(server, resolveClient);
  registerSablondanSozlesme(server, resolveClient);
  registerHatirlatmaGonder(server, resolveClient);
  registerSozlesmelerim(server, resolveClient);
  registerSozlesmeIptal(server, resolveClient);
  registerKisilerim(server, resolveClient);
  registerKisiEkle(server, resolveClient);
  registerZamanDamgalarim(server, resolveClient);
  registerSozlesmeAudit(server, resolveClient);
  registerSozlesmeSertifikasi(server, resolveClient);
  registerRaporlar(server, resolveClient);
  registerTopluSozlesmeGonder(server, resolveClient);

  return server;
}
