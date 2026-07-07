import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatTimestampList, formatError } from '../format.js';

export const zamanDamgalarimInputSchema = {
  sayfa: z.number().int().positive().optional().describe('Sayfa numarası (varsayılan 1)'),
  limit: z.number().int().positive().max(100).optional().describe('Sayfa boyutu (varsayılan 20, en fazla 100)'),
};

export function registerZamanDamgalarim(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'zaman_damgalarim',
    {
      description:
        'İmzala hesabındaki (veya organizasyon çalışma alanındaki) RFC 3161 zaman damgalarını (Eser Tasdik) listeler. Her kayıt için dosya adı, damga tarihi ve durum döner. Sözleşme tamamlanınca otomatik üretilen damgalar bu listede gösterilmez (onlar sözleşme sayfasından indirilir).',
      inputSchema: zamanDamgalarimInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const list = await client!.listTimestamps({ page: args.sayfa, limit: args.limit });
        return { content: [{ type: 'text' as const, text: formatTimestampList(list) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
