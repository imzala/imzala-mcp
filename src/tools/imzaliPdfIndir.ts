import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatError } from '../format.js';
import { savePdfExclusive } from '../savePdf.js';

// Guard against dumping a huge base64 blob into the chat when no save_path given.
const MAX_INLINE_BYTES = 5 * 1024 * 1024; // 5 MB

export const imzaliPdfIndirInputSchema = {
  demand_id: z.string().describe('İmzalı PDF\'i indirilecek tamamlanmış sözleşmenin kimliği'),
  belge_id: z.string().optional().describe('Çok belgeli zarfta indirilecek belgenin kimliği (sozlesme_durumu çıktısındaki belge kimliği). Tek belgeli sözleşmede gerekmez.'),
  save_path: z.string().optional().describe('PDF\'in kaydedileceği yerel dosya yolu: mutlak yol ve .pdf uzantısı gerekir, var olan dosyanın üzerine yazılmaz (verilmezse base64 döner)'),
};

export function registerImzaliPdfIndir(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'imzali_pdf_indir',
    {
      description:
        'Tamamlanmış bir sözleşmenin imzalı PDF\'ini indirir. Sözleşmenin sahipliği önce doğrulanır; yalnız tamamlanmış (COMPLETED) sözleşmelerde çalışır. Çok belgeli zarfta her belgenin ayrı PDF\'i vardır: `belge_id` verilmezse araç belgeleri listeler, hangisini istediğinizi belirtip yeniden çağırırsınız. Belge henüz mühürleniyorsa PDF birkaç dakika sonra hazır olur.',
      inputSchema: imzaliPdfIndirInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        // Ownership + completion gate via the scoped endpoint, before any download.
        const demand = await client!.getDemand(args.demand_id);
        if (demand.status !== 'COMPLETED') {
          return {
            content: [{ type: 'text' as const, text: `Bu sözleşme henüz tamamlanmadı (durum: ${demand.status}), imzalı PDF hazır değil.` }],
            isError: true,
          };
        }
        // Without a document id the endpoint silently serves only the FIRST
        // document of a multi-document envelope, so ask instead of guessing.
        const docs = demand.documents ?? [];
        if (!args.belge_id && docs.length > 1) {
          const list = docs.map((d) => `- ${d.order}. ${d.title} (belge_id: ${d.id})`).join('\n');
          return {
            content: [{ type: 'text' as const, text: `Bu sözleşme ${docs.length} belgeli bir zarf; her belgenin imzalı PDF'i ayrıdır. İstediğiniz belgeyi belge_id ile belirtip aracı yeniden çağırın:\n${list}` }],
          };
        }
        const buf = await client!.downloadSignedPdf(args.demand_id, args.belge_id);
        if (args.save_path) {
          const saveError = await savePdfExclusive(args.save_path, buf);
          if (saveError) return { content: [{ type: 'text' as const, text: saveError }], isError: true };
          return { content: [{ type: 'text' as const, text: `İmzalı PDF kaydedildi: ${args.save_path} (${buf.length} bayt)` }] };
        }
        if (buf.length > MAX_INLINE_BYTES) {
          return {
            content: [{ type: 'text' as const, text: `PDF çok büyük (${buf.length} bayt), base64 olarak döndürülemez. Lütfen save_path verin.` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: `İmzalı PDF (base64):\n${buf.toString('base64')}` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
