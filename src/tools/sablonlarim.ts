import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatTemplateList, formatError } from '../format.js';

export const sablonlarimInputSchema = {
  page: z.number().int().positive().optional().describe('Sayfa numarası (varsayılan 1)'),
  limit: z.number().int().positive().max(100).optional().describe('Sayfa boyutu (varsayılan 20, en fazla 100)'),
};

export function registerSablonlarim(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sablonlarim',
    {
      description: 'İmzala hesabındaki sözleşme şablonlarını listeler.',
      inputSchema: sablonlarimInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const list = await client!.listTemplates(args.page, args.limit);
        return { content: [{ type: 'text' as const, text: formatTemplateList(list) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
