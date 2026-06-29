// STUB — Task 5 implements the real handler
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';

export const eserTescilInputSchema = {
  file_path: z.string().optional().describe('Zaman damgası uygulanacak dosyanın yerel yolu'),
  file_base64: z.string().optional().describe('Zaman damgası uygulanacak dosyanın base64 içeriği'),
  file_name: z.string().describe('Dosya adı (uzantı dahil, ör. belge.pdf)'),
  owner_first_name: z.string().optional().describe('Eser sahibinin adı'),
  owner_last_name: z.string().optional().describe('Eser sahibinin soyadı'),
  description: z.string().optional().describe('Eser açıklaması'),
  idempotency_key: z.string().optional().describe('Tekrarlı istekleri önlemek için idempotency anahtarı'),
};

export function registerEserTescil(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'eser_tescil',
    {
      description: 'RFC 3161 zaman damgası ile eser tescili yapar ve tescil kaydını döndürür',
      inputSchema: eserTescilInputSchema,
    },
    async (_args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      void client; // Task 5 will use client.createTimestamp()
      return { content: [{ type: 'text' as const, text: 'eser_tescil: not yet implemented' }] };
    },
  );
}
