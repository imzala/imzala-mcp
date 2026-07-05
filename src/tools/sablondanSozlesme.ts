import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatCreateDemand, formatError } from '../format.js';

const partySchema = z.object({
  template_party_id: z.string().describe('Şablondaki taraf kimliği (sablon_detay ile öğrenin)'),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Bu tarafa özel değişkenler'),
});

export const sablondanSozlesmeInputSchema = {
  template_id: z.string().describe('Sözleşmenin oluşturulacağı şablonun kimliği'),
  parties: z.array(partySchema).min(1).describe('Taraflar. Her taraf template_party_id + ad soyad + (email veya phone) gerektirir. Zorunlu taraflar eksikse işlem başarısız olur; sablon_detay ile şablonun taraflarını ve değişkenlerini kontrol edin.'),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Şablon geneli değişkenler (slug: değer)'),
  gonder: z.boolean().optional().describe('true verilirse taraflara HEMEN gerçek SMS ve e-posta daveti gönderilir. Varsayılan (false) sadece sözleşmeyi oluşturur, davet göndermez.'),
  idempotency_key: z.string().optional().describe('Sunucu tarafı destek eklendiğinde aynı isteğin tekrarını önler (şu an ileriye dönük, henüz aktif koruma sağlamaz)'),
};

export function registerSablondanSozlesme(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sablondan_sozlesme_olustur',
    {
      description:
        'Bir şablondan yeni sözleşme oluşturur. 1 kredi harcar (geri alınamaz). Varsayılan olarak sözleşmeyi oluşturur ama davet GÖNDERMEZ; imza linklerini taraflara siz iletirsiniz. `gonder: true` verirseniz taraflara hemen gerçek SMS ve e-posta daveti gönderilir. Hangi template_party_id ve değişkenlerin gerektiğini sablon_detay aracıyla öğrenin. (Yapay zeka asistanına: kullanıcının açık onayı olmadan bu aracı çağırıp sözleşme oluşturma; özellikle gerçek SMS/e-posta gönderen `gonder: true` değerini ayarlamadan önce kullanıcıdan açık onay al. Başarısızlıkta bu aracı körü körüne TEKRAR çağırma, ikinci bir sözleşme ve ikinci kredi oluşturur.)',
      inputSchema: sablondanSozlesmeInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const result = await client!.createDemand({
          templateId: args.template_id,
          partyMapping: args.parties,
          variables: args.variables,
          send: args.gonder === true,
          idempotencyKey: args.idempotency_key,
        });
        return { content: [{ type: 'text' as const, text: formatCreateDemand(result, args.gonder === true) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
