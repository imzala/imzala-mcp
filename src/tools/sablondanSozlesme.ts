import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatCreateDemand, formatError } from '../format.js';

const partySchema = z.object({
  template_party_id: z.string().describe('Şablondaki tarafın tam kimliği (UUID). sablon_detay çıktısında her taraf için verilen "template_party_id" değerini AYNEN kullan; tarafın adını/etiketini (ör. "İmzalayan") DEĞİL.'),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Bu tarafa özel değişkenler'),
});

const documentSelectionSchema = z.object({
  include: z.array(z.string()).max(20).optional().describe('Şablonda varsayılan olarak gönderilmeyen belgeleri bu imza sürecine EKLER. sablon_detay çıktısındaki belge kimliklerini (UUID) aynen kullanın. En fazla 20 kimlik.'),
  exclude: z.array(z.string()).max(20).optional().describe('Şablonda varsayılan olarak gönderilen belgeleri bu imza sürecinden ÇIKARIR (zorunlu işaretli belgeler de çıkarılabilir). En fazla 20 kimlik.'),
});

const DOCUMENTS_DESCRIPTION =
  'Bu istekte gönderilecek belgeleri şablonun varsayılanına göre değiştirir. Hiç göndermezseniz şablonun varsayılan belge kümesi gider. Çıkarılan belge imzacıya gösterilmez, imzalı PDF\'te ve tamamlanma sertifikasında yer almaz, kredi hesabına girmez. Sonuçta en az bir belge kalmalı ve eşlediğiniz her role en az bir belge düşmelidir. Belge kimliklerini sablon_detay ile alın (şablon kopyalandığında kimlikler değişir). Mevzuat gereği karşı tarafa verilmesi gereken belgeleri (ör. ön bilgilendirme formu, aydınlatma metni) başka bir kanaldan vermiyorsanız çıkarmayın; bu belgelerin verilmesi yükümlülüğü sözleşmeyi gönderene aittir.';

export const sablondanSozlesmeInputSchema = {
  template_id: z.string().describe('Sözleşmenin oluşturulacağı şablonun kimliği'),
  parties: z.array(partySchema).min(1).describe('Taraflar. Her taraf template_party_id + ad soyad + (email veya phone) gerektirir. Zorunlu taraflar eksikse işlem başarısız olur; sablon_detay ile şablonun taraflarını ve değişkenlerini kontrol edin.'),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Şablon geneli değişkenler (slug: değer)'),
  documents: documentSelectionSchema.optional().describe(DOCUMENTS_DESCRIPTION),
  gonder: z.boolean().optional().describe('true verilirse taraflara HEMEN gerçek SMS ve e-posta daveti gönderilir. Varsayılan (false) sadece sözleşmeyi oluşturur, davet göndermez.'),
  idempotency_key: z.string().optional().describe('Sunucu tarafı destek eklendiğinde aynı isteğin tekrarını önler (şu an ileriye dönük, henüz aktif koruma sağlamaz)'),
};

export function registerSablondanSozlesme(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sablondan_sozlesme_olustur',
    {
      description:
        'Bir şablondan TEK bir yeni sözleşme oluşturur. Tek belgeli şablonda 1 kredi harcar; çok belgeli zarfta maliyet imzacı başına o imzacıya atanan belge sayısına göre artar (belge sayısı arttıkça kademeli indirim uygulanır). Harcama geri alınamaz. Varsayılan olarak sözleşmeyi oluşturur ama davet GÖNDERMEZ; imza linklerini taraflara siz iletirsiniz. `gonder: true` verirseniz taraflara hemen gerçek SMS ve e-posta daveti gönderilir. Hangi template_party_id, değişken ve belgelerin gerektiğini sablon_detay aracıyla öğrenin. Şablon birden çok belge içeriyorsa `documents.include` / `documents.exclude` ile bu sözleşmede gönderilecek belgeleri seçebilirsiniz. Birden çok alıcıya AYNI şablondan AYRI AYRI sözleşme oluşturacaksan bu aracı tek tek çağırmak yerine `toplu_sozlesme_gonder` kullan (tek çağrıda 10 alıcıya kadar, satır-başı kısmi başarı). (Yapay zeka asistanına: kullanıcının açık onayı olmadan bu aracı çağırıp sözleşme oluşturma; özellikle gerçek SMS/e-posta gönderen `gonder: true` değerini ayarlamadan önce kullanıcıdan açık onay al. Başarısızlıkta bu aracı körü körüne TEKRAR çağırma, ikinci bir sözleşme ve ikinci kredi oluşturur.)',
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
          documents: args.documents,
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
