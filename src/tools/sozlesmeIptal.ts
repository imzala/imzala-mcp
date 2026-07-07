import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatCancelDemand, formatError } from '../format.js';

export const sozlesmeIptalInputSchema = {
  demand_id: z.string().describe('İptal edilecek sözleşmenin (demand) kimliği'),
  sebep: z.string().optional().describe('İptal sebebi (opsiyonel, kayda yazılır)'),
};

export function registerSozlesmeIptal(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesme_iptal',
    {
      description:
        'Bekleyen bir sözleşmeyi İmzala.org üzerinde iptal eder (platform iptali). Bu işlem KESİN ve GERİ ALINAMAZ: sözleşme iptal (void) durumuna geçer, bekleyen tüm imza davetleri ve hatırlatmalar durdurulur. Tamamlanmış (COMPLETED) sözleşme iptal edilemez. Bu bir platform iptalidir; imzalanmış bir belgenin hukuki feshi (fesih) DEĞİLDİR, öyle sunulmamalıdır. (Yapay zeka asistanına: bu aracı kullanıcının AÇIK onayı olmadan ASLA çağırma. Çağırmadan önce mutlaka sozlesme_durumu aracıyla sözleşmenin başlığını, taraflarını ve durumunu DOĞRULA; kullanıcıya hangi sözleşmeyi iptal etmek üzere olduğunu göster ve onay al. Taraflardan biri sözleşmeyi ZATEN İMZALADIYSA, iptalden önce kullanıcıyı bu konuda açıkça UYAR. İşlemin geri alınamaz olduğunu kullanıcıya hatırlat. Başarısızlıkta bu aracı körü körüne tekrar çağırma.)',
      inputSchema: sozlesmeIptalInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const result = await client!.cancelDemand(args.demand_id, args.sebep);
        return { content: [{ type: 'text' as const, text: formatCancelDemand(result) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
