import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatContractStatus, formatError } from '../format.js';

export const sozlesmeDurumuInputSchema = {
  demand_id: z.string().describe('Durumu sorgulanacak sözleşmenin (demand) kimliği'),
};

export function registerSozlesmeDurumu(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesme_durumu',
    {
      description:
        'Bir sözleşmenin durumunu ve hangi tarafların imzaladığını gösterir. "X sözleşmesini kim imzaladı / imzalandı mı" sorularını yanıtlar.',
      inputSchema: sozlesmeDurumuInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const demand = await client!.getDemand(args.demand_id);
        return { content: [{ type: 'text' as const, text: formatContractStatus(demand) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
