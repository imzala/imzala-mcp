import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatEserTescil, formatError } from '../format.js';

export const eserTescilInputSchema = {
  file_path: z.string().optional().describe('Zaman damgası uygulanacak dosyanın yerel yolu'),
  file_base64: z
    .string()
    .optional()
    .describe('Zaman damgası uygulanacak dosyanın standart canonical base64 içeriği (data-URL değil)'),
  file_name: z.string().describe('Dosya adı (uzantı dahil, ör. belge.pdf)'),
  owner_first_name: z.string().optional().describe('Eser sahibinin adı (beyan)'),
  owner_last_name: z.string().optional().describe('Eser sahibinin soyadı (beyan)'),
  description: z.string().optional().describe('Eser açıklaması'),
  idempotency_key: z
    .string()
    .optional()
    .describe('Aynı isteği tekrarlamayı önlemek için idempotency anahtarı'),
};

// ---------------------------------------------------------------------------
// Canonical base64 validation
// ---------------------------------------------------------------------------

/**
 * Standard canonical base64 alphabet + optional `=` padding.
 * Rejects data-URL schemes (data:...) and URL-safe variants (- / _).
 */
const CANONICAL_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Returns true only if `s` is valid, standard, canonical base64:
 * - Uses only A-Z a-z 0-9 + / characters with at most two `=` padding chars.
 * - Passes round-trip encode/decode (ensures no truncated or malformed input).
 *
 * Rejects: data-URLs, URL-safe base64 (- and _), arbitrary strings.
 */
function isCanonicalBase64(s: string): boolean {
  if (!CANONICAL_BASE64_RE.test(s)) return false;
  // Round-trip: re-encode the decoded bytes and compare
  return Buffer.from(s, 'base64').toString('base64') === s;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerEserTescil(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'eser_tescil',
    {
      description:
        'RFC 3161 zaman damgası alır: dosyanın en geç belirtilen anda var olduğunu ve değişmediğini kriptografik olarak kanıtlar. Bu bir imza veya eser tescili DEĞİLDİR.',
      inputSchema: eserTescilInputSchema,
    },
    async (args) => {
      // ------------------------------------------------------------------
      // Step 1: XOR validation — exactly one of file_path / file_base64
      // ------------------------------------------------------------------
      const filePath = args.file_path ?? '';
      const fileBase64 = args.file_base64 ?? '';
      const hasPath = filePath.length > 0;
      const hasB64 = fileBase64.length > 0;

      if (!hasPath && !hasB64) {
        return inputError(
          "file_path veya file_base64'ten birini verin (ikisini birden değil)",
        );
      }
      if (hasPath && hasB64) {
        return inputError(
          "file_path veya file_base64'ten birini verin (ikisini birden değil)",
        );
      }

      // ------------------------------------------------------------------
      // Step 2: Resolve file buffer
      // ------------------------------------------------------------------
      let buf: Buffer;

      if (hasPath) {
        try {
          const { readFile } = await import('node:fs/promises');
          buf = await readFile(filePath);
        } catch (e) {
          return inputError(
            `Dosya okunamadı: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      } else {
        // base64 path
        if (fileBase64.startsWith('data:')) {
          return inputError(
            'file_base64 geçersiz (standart canonical base64 olmalı, data-URL/URL-safe değil)',
          );
        }
        if (!isCanonicalBase64(fileBase64)) {
          return inputError(
            'file_base64 geçersiz (standart canonical base64 olmalı, data-URL/URL-safe değil)',
          );
        }
        buf = Buffer.from(fileBase64, 'base64');
      }

      // ------------------------------------------------------------------
      // Step 3: Resolve API client (auth check)
      // ------------------------------------------------------------------
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }

      // ------------------------------------------------------------------
      // Step 4: Call backend + format legally-mandated output
      // ------------------------------------------------------------------
      try {
        const result = await client!.createTimestamp({
          fileBuffer: buf,
          fileName: args.file_name,
          description: args.description,
          ownerFirstName: args.owner_first_name,
          ownerLastName: args.owner_last_name,
          idempotencyKey: args.idempotency_key,
        });

        return {
          content: [{ type: 'text' as const, text: formatEserTescil(result, args.file_name) }],
        };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: formatError(e) }],
          isError: true,
        };
      }
    },
  );
}
