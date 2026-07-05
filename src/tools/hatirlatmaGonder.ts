import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatReminder, formatError } from '../format.js';

export const hatirlatmaGonderInputSchema = {
  demand_id: z.string().describe('Hatırlatma gönderilecek sözleşmenin kimliği'),
  kanallar: z.array(z.enum(['sms', 'email'])).optional().describe('Hangi kanallardan gönderilsin (varsayılan: ikisi de)'),
  zorla: z.boolean().optional().describe('true verilirse 5 dakikalık bekleme süresi aşılır (kişi başı 3 SMS + 3 e-posta sınırı yine geçerli)'),
};

export function registerHatirlatmaGonder(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'hatirlatma_gonder',
    {
      description:
        'Bir sözleşmede henüz imzalamamış taraflara gerçek SMS ve e-posta hatırlatması gönderir. Bu araç gerçek mesaj gönderir (iletişim işlemi). Aynı sözleşmeye 5 dakika içinde tekrar hatırlatma engellenir (zorla: true ile aşılabilir); kişi başına en fazla 3 SMS ve 3 e-posta gönderilir. (Yapay zeka asistanına: bu araç kullanıcının onayı olmadan gerçek mesaj göndermek için kullanılmamalı.)',
      inputSchema: hatirlatmaGonderInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const result = await client!.sendReminder({ demandId: args.demand_id, channels: args.kanallar, force: args.zorla });
        return { content: [{ type: 'text' as const, text: formatReminder(result) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
