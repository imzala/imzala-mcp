import { z } from 'zod';
import { writeFile } from 'fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatError } from '../format.js';

// Chat'e devasa base64 blob dökülmesini engelle (save_path yoksa).
const MAX_INLINE_BYTES = 5 * 1024 * 1024; // 5 MB

export const sozlesmeSertifikasiInputSchema = {
  demand_id: z.string().describe('Tamamlanma sertifikası indirilecek sözleşmenin kimliği'),
  save_path: z.string().optional().describe('Sertifika PDF\'inin kaydedileceği yerel dosya yolu (verilmezse base64 döner)'),
};

export function registerSozlesmeSertifikasi(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesme_sertifikasi',
    {
      description:
        'Tamamlanmış bir sözleşmenin tamamlanma/denetim sertifikasını (PDF) indirir. Sertifika, sözleşmenin kim tarafından ne zaman imzalandığını özetleyen resmi belgedir. Yalnız tamamlanmış (COMPLETED) sözleşmelerde çalışır; sözleşmenin sahipliği doğrulanır. İmzalı sözleşmenin kendisi için imzali_pdf_indir aracını kullanın.',
      inputSchema: sozlesmeSertifikasiInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        // Sahiplik + COMPLETED kapısı scope'lu /certificate endpoint'inde (409 döner).
        const buf = await client!.downloadCertificate(args.demand_id);
        if (args.save_path) {
          await writeFile(args.save_path, buf);
          return { content: [{ type: 'text' as const, text: `Tamamlanma sertifikası kaydedildi: ${args.save_path} (${buf.length} bayt)` }] };
        }
        if (buf.length > MAX_INLINE_BYTES) {
          return {
            content: [{ type: 'text' as const, text: `Sertifika PDF'i çok büyük (${buf.length} bayt), base64 olarak döndürülemez. Lütfen save_path verin.` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: `Tamamlanma sertifikası (base64):\n${buf.toString('base64')}` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
