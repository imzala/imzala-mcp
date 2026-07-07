import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResolveClient } from './whoami.js';
import { formatContactCreate, formatError } from '../format.js';

// 🔴 KVKK (m.4 minimizasyon + m.9): T.C. Kimlik No (government_id) BİLEREK YOK.
// Bu araç şemasında TC alanı tanımlanmaz; kullanıcı isteyse bile bu kanaldan
// (yurt dışı AI sağlayıcısı) en hassas tanımlayıcı toplanmaz/gönderilmez.
export const kisiEkleInputSchema = {
  first_name: z.string().describe('Ad (zorunlu)'),
  last_name: z.string().describe('Soyad (zorunlu)'),
  email: z.string().optional().describe('E-posta (opsiyonel)'),
  phone: z.string().optional().describe('Telefon (opsiyonel, ör. +905xxxxxxxxx)'),
  job_title: z.string().optional().describe('Unvan / görev (opsiyonel)'),
  address_country: z.string().optional().describe('Adres: ülke (opsiyonel)'),
  address_city: z.string().optional().describe('Adres: il (opsiyonel)'),
  address_district: z.string().optional().describe('Adres: ilçe (opsiyonel)'),
  address_line: z.string().optional().describe('Adres: açık adres (opsiyonel)'),
};

export function registerKisiEkle(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'kisi_ekle',
    {
      description:
        'İmzala rehberine yeni bir kişi kaydeder. Sistem kişiyi yalnızca KAYDEDER, kimliğini DOĞRULAMAZ; kayıt kişinin beyan edilen bilgileridir, doğrulanmış kimlik teşkil etmez. Aynı çalışma alanında aynı e-posta veya telefona sahip aktif bir kişi varsa işlem başarısız olur (kopya kayıt oluşturulmaz). T.C. Kimlik Numarası bu araçla KABUL EDİLMEZ (KVKK gereği). (Yapay zeka asistanına: bu aracı kullanıcının açık onayı olmadan çağırıp kişi oluşturma; kaydedilecek ad, soyad ve iletişim bilgilerini kullanıcıya doğrulat. Kaydedilen kişiyi "doğrulanmış" veya "kimliği teyit edilmiş" gibi sunma.)',
      inputSchema: kisiEkleInputSchema,
    },
    async (args) => {
      const { client, errorText } = await resolveClient();
      if (errorText) return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      try {
        const contact = await client!.createContact({
          first_name: args.first_name,
          last_name: args.last_name,
          email: args.email,
          phone: args.phone,
          job_title: args.job_title,
          address_country: args.address_country,
          address_city: args.address_city,
          address_district: args.address_district,
          address_line: args.address_line,
        });
        return { content: [{ type: 'text' as const, text: formatContactCreate(contact) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
