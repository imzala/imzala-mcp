import { z } from 'zod';
import { writeFile } from 'fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatError } from '../format.js';

// Guard against dumping a huge base64 blob into the chat when no save_path given.
const MAX_INLINE_BYTES = 5 * 1024 * 1024; // 5 MB

export const imzaliPdfIndirInputSchema = {
  demand_id: z.string().describe('İmzalı PDF\'i indirilecek tamamlanmış sözleşmenin kimliği'),
  save_path: z.string().optional().describe('PDF\'in kaydedileceği yerel dosya yolu (verilmezse base64 döner)'),
};

export function registerImzaliPdfIndir(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'imzali_pdf_indir',
    {
      description:
        'Tamamlanmış bir sözleşmenin imzalı PDF\'ini indirir. Sözleşmenin sahipliği önce doğrulanır; yalnız tamamlanmış (COMPLETED) sözleşmelerde çalışır.',
      inputSchema: imzaliPdfIndirInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        // Ownership + completion gate via scoped endpoint (NEVER hit public /sonuc directly from input).
        const demand = await client!.getDemand(args.demand_id);
        if (demand.status !== 'COMPLETED' || !demand.pdf_url) {
          return {
            content: [{ type: 'text' as const, text: `Bu sözleşme henüz tamamlanmadı (durum: ${demand.status}), imzalı PDF hazır değil.` }],
            isError: true,
          };
        }
        const buf = await client!.downloadPdf(demand.pdf_url);
        if (args.save_path) {
          await writeFile(args.save_path, buf);
          return { content: [{ type: 'text' as const, text: `İmzalı PDF kaydedildi: ${args.save_path} (${buf.length} bayt)` }] };
        }
        if (buf.length > MAX_INLINE_BYTES) {
          return {
            content: [{ type: 'text' as const, text: `PDF çok büyük (${buf.length} bayt), base64 olarak döndürülemez. Lütfen save_path verin. İndirme linki: ${demand.pdf_url}` }],
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
