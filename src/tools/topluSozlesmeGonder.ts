import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatBulkResult, formatError } from '../format.js';

const bulkRowSchema = z.object({
  party_mapping: z.array(z.any()).describe('Bu satırın taraf eşlemesi (sablondan_sozlesme_olustur ile aynı şekil: template_party_id + ad soyad + email/phone)'),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Bu satıra özel değişkenler'),
});

const bulkOptionsSchema = z.object({
  dispatch_notifications: z.boolean().optional().describe('true verilirse taraflara HEMEN gerçek SMS ve e-posta daveti gönderilir'),
  ordered: z.boolean().optional().describe('true verilirse taraflar sırayla imzalar (bir taraf imzalayana kadar sıradaki taraf imza davetini almaz)'),
  sms_content: z.string().optional().describe('SMS davet metni özelleştirmesi (opsiyonel)'),
  language: z.string().optional().describe('Davet dili (opsiyonel, ör. tr)'),
});

export const topluSozlesmeGonderInputSchema = {
  template_id: z.string().describe('Sözleşmelerin oluşturulacağı şablonun kimliği (sablon_detay ile öğrenin)'),
  options: bulkOptionsSchema.optional().describe('Toplu gönderim seçenekleri (opsiyonel)'),
  rows: z.array(bulkRowSchema).min(1).max(10).describe('Her biri ayrı bir sözleşme olacak en fazla 10 satır. Daha büyük listeleri 10\'arlı parçalara bölün.'),
};

export function registerTopluSozlesmeGonder(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'toplu_sozlesme_gonder',
    {
      description:
        "Tek şablondan en fazla 10 kişiye ayrı ayrı sözleşme oluşturur ve her birine imza daveti gönderir. Önce sablon_detay ile şablonun alanlarını öğren. Daha büyük listeleri 10'arlı parçalara böl. Alıcı ad, e-posta ve telefon bu araç üzerinden iletilir. Pazarlama değil, yalnızca imza daveti. (Yapay zeka asistanına: bu aracı kullanıcının açık onayı olmadan çağırıp toplu sözleşme oluşturma/gönderme; her satırdaki alıcı bilgilerini ve gönderim seçeneklerini kullanıcıya doğrulat. Her satır ayrı kredi harcar ve geri alınamaz; başarısızlıkta bu aracı körü körüne TEKRAR çağırma.)",
      inputSchema: topluSozlesmeGonderInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const result = await client!.bulkCreateDemands({
          template_id: args.template_id,
          options: args.options,
          rows: args.rows,
        });
        return { content: [{ type: 'text' as const, text: formatBulkResult(result) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
