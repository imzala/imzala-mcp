import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatTemplateDetail, formatError } from '../format.js';

export const sablonDetayInputSchema = {
  template_id: z.string().describe('Detayı istenen şablonun kimliği'),
};

export function registerSablonDetay(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sablon_detay',
    {
      description:
        'Bir şablonun detayını gösterir: taraflar ve doldurulabilir değişkenler. Şablondan sözleşme oluşturmadan önce hangi değişkenlerin gerektiğini öğrenmek için kullanılır.',
      inputSchema: sablonDetayInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const t = await client!.getTemplate(args.template_id);
        return { content: [{ type: 'text' as const, text: formatTemplateDetail(t) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
