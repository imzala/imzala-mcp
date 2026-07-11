import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatDemandList, formatError } from '../format.js';

// Türkçe durum → API status map. Tool'un dışa bakan arayüzü Türkçe, backend
// enum'u İngilizce (buildDemandWhere PENDING/COMPLETED/CANCELLED/EXPIRED bekler).
const DURUM_TO_STATUS: Record<string, string> = {
  bekliyor: 'PENDING',
  tamamlandi: 'COMPLETED',
  iptal: 'CANCELLED',
  'suresi-doldu': 'EXPIRED',
};

export const sozlesmelerimInputSchema = {
  durum: z
    .enum(['bekliyor', 'tamamlandi', 'iptal', 'suresi-doldu'])
    .optional()
    .describe('Duruma göre filtrele: bekliyor / tamamlandi / iptal / suresi-doldu'),
  arama: z.string().optional().describe('Başlığa göre serbest metin araması'),
  baslangic_tarih: z
    .string()
    .optional()
    .describe(
      'Bu tarihten itibaren oluşturulan sözleşmeler (dahil). ISO tarih biçimi YYYY-MM-DD (ör. 2026-06-01). "Son 30 gün", "bu ay", "geçen hafta" gibi göreli ifadeleri bu alan için uygun tarihe çevirin.',
    ),
  bitis_tarih: z
    .string()
    .optional()
    .describe('Bu tarihe kadar oluşturulan sözleşmeler (dahil). ISO tarih biçimi YYYY-MM-DD (ör. 2026-06-30).'),
  sayfa: z.number().int().positive().optional().describe('Sayfa numarası (varsayılan 1)'),
  limit: z.number().int().positive().max(100).optional().describe('Sayfa boyutu (varsayılan 20, en fazla 100)'),
};

export function registerSozlesmelerim(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesmelerim',
    {
      description:
        'İmzala hesabındaki (veya organizasyon çalışma alanındaki) sözleşmeleri listeler. Duruma (bekliyor/tamamlandi/iptal/suresi-doldu), başlığa ve TARİH ARALIĞINA (baslangic_tarih / bitis_tarih) göre filtrelenebilir, sayfalanır. "Son 30 gün", "bu ay" gibi tarih sorularında baslangic_tarih/bitis_tarih alanlarını kullanın. Yalnızca özet döner (başlık, durum, imzalayan taraf sayısı); taraf isimleri/e-postaları KVKK gereği listelenmez, ayrıntı için sozlesme_durumu aracını kimlik ile çağırın.',
      inputSchema: sozlesmelerimInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const list = await client!.listDemands({
          status: args.durum ? DURUM_TO_STATUS[args.durum] : undefined,
          q: args.arama,
          from: args.baslangic_tarih,
          to: args.bitis_tarih,
          page: args.sayfa,
          limit: args.limit,
        });
        return { content: [{ type: 'text' as const, text: formatDemandList(list) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
