import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatContactList, formatError } from '../format.js';

export const kisilerimInputSchema = {
  arama: z.string().optional().describe('İsim, e-posta veya telefona göre serbest metin araması'),
  sayfa: z.number().int().positive().optional().describe('Sayfa numarası (varsayılan 1)'),
  limit: z.number().int().positive().max(100).optional().describe('Sayfa boyutu (varsayılan 20, en fazla 100)'),
};

export function registerKisilerim(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'kisilerim',
    {
      description:
        'İmzala hesabındaki (veya organizasyon çalışma alanındaki) kayıtlı kişileri (rehber) listeler. İsim, e-posta veya telefona göre aranabilir, sayfalanır. Yanıt T.C. Kimlik Numarası içermez (KVKK gereği bu kanalda ifşa edilmez).',
      inputSchema: kisilerimInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const list = await client!.listContacts({ q: args.arama, page: args.sayfa, limit: args.limit });
        return { content: [{ type: 'text' as const, text: formatContactList(list) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
