import { describe, test, expect, vi } from 'vitest';
import { createServer } from '../server.js';

// API 1.14.3 alignment: cancel and delete describe the credit refund conditions.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
const tools = (server as unknown as PrivateServer)._registeredTools;

describe.each(['sozlesme_iptal', 'sozlesme_sil'])('%s kredi iadesi', (name) => {
  const description = tools[name].description ?? '';

  test('iade koşullarını sayar', () => {
    expect(description).toMatch(/imza bekleyen ve toplu olmayan sözleşmede gönderimde düşülen kredi iade edilir/);
    expect(description).toMatch(/hiçbir taraf imzalamamış ya da onaylamamış/);
    expect(description).toMatch(/bekleyen bir mobil imza isteği bulunmamalıdır/);
    expect(description).toMatch(/Tamamlanmış ücretli doğrulama adımlarının kredisi iadeden düşülür/);
  });

  test('iadeyi vaat etmez, kararı sunucuya bırakır', () => {
    expect(description).toMatch(/Koşullar sağlanırsa/);
    expect(description).toMatch(/iadeye sunucu karar verir/);
    expect(description).not.toContain('—');
  });
});
