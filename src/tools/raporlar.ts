import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatReports, formatError } from '../format.js';

export function registerRaporlar(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'raporlar',
    {
      description:
        'İmzala hesabınızın (veya organizasyon çalışma alanınızın) sözleşme özetini döndürür: toplam sözleşme sayısı, duruma göre dağılım (bekleyen / tamamlanan / iptal / süresi dolmuş) ve bu ay oluşturulan sözleşme sayısı. Yalnızca sayı döner, taraf bilgisi (PII) içermez. "Kaç sözleşmem tamamlandı?", "bu ay kaç sözleşme oluşturdum?" gibi soruları cevaplar.',
      inputSchema: {},
    },
    async () => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      try {
        const r = await client!.getReports();
        return { content: [{ type: 'text' as const, text: formatReports(r) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
