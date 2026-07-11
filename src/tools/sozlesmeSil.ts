import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatDeleteDemand, formatError } from '../format.js';

export const sozlesmeSilInputSchema = {
  demand_id: z.string().describe('Kalıcı olarak silinecek sözleşmenin (demand) kimliği'),
};

export function registerSozlesmeSil(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'sozlesme_sil',
    {
      description:
        'Bekleyen bir sözleşmeyi İmzala.org üzerinden KALICI olarak siler (hard delete). Sözleşme, tüm sayfaları, alanları ve yüklenen dosyaları geri DÖNÜŞÜ OLMAYACAK şekilde kaldırılır; kayıt listelerden tamamen kaybolur. Tamamlanmış (COMPLETED) sözleşme API üzerinden SİLİNEMEZ (imzalı belge korunur). Bu, sozlesme_iptal aracından FARKLIDIR: iptal sözleşmeyi "iptal edildi" durumuna alır ama kayıt DURUR; silme ise kaydı tümüyle YOK EDER. Yalnızca gerçekten kaldırmak istediğiniz taslak/bekleyen sözleşmeler için kullanın; çoğu durumda iptal (sozlesme_iptal) daha uygundur. (Yapay zeka asistanına: bu YIKICI aracı kullanıcının AÇIK ve NET onayı olmadan ASLA çağırma. Çağırmadan önce mutlaka sozlesme_durumu ile sözleşmenin başlığını, taraflarını ve durumunu DOĞRULA; kullanıcıya hangi sözleşmeyi kalıcı sileceğini göster, işlemin GERİ ALINAMAZ olduğunu net söyle ve onay al. Silmek yerine iptal etmek isteyip istemediğini kullanıcıya sor. Başarısızlıkta körü körüne tekrar çağırma.)',
      inputSchema: sozlesmeSilInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const result = await client!.deleteDemand(args.demand_id);
        return { content: [{ type: 'text' as const, text: formatDeleteDemand(result) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
