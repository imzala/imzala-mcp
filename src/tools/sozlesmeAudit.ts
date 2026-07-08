import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatDemandTimeline, formatError } from '../format.js';

export const sozlesmeAuditInputSchema = {
  demand_id: z.string().describe('Denetim izi (timeline) istenen sözleşmenin kimliği'),
};

export function registerSozlesmeAudit(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesme_audit',
    {
      description:
        'Bir sözleşmenin denetim izini (timeline) döndürür: sözleşme ne zaman oluşturuldu, hangi taraf ne zaman görüntüledi/imzaladı, ne zaman tamamlandı/iptal edildi. Aktör (ad/e-posta) ve IP bilgileri KVKK gereği maskelidir. Yalnızca kendi hesabınızdaki (veya organizasyon çalışma alanınızdaki) sözleşmelerde çalışır; sahiplik doğrulanır. Girdi: demand_id (sözleşme kimliği, sozlesme_durumu veya sozlesmelerim ile öğrenilir).',
      inputSchema: sozlesmeAuditInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const r = await client!.getDemandTimeline(args.demand_id);
        return { content: [{ type: 'text' as const, text: formatDemandTimeline(r) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
