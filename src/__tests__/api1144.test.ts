import { describe, test, expect, vi } from 'vitest';
import { createServer } from '../server.js';

// API 1.14.4 alignment: reminders follow the demand edit scope inside an organization.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
const description = (server as unknown as PrivateServer)._registeredTools['hatirlatma_gonder'].description ?? '';

describe('hatirlatma_gonder kurum içi kapsam', () => {
  test('varsayılan rol izinlerini ve izin ayarlarını anlatır', () => {
    expect(description).toMatch(/sözleşme düzenleme izninin kapsamına bağlıdır/);
    expect(description).toMatch(/MEMBER yalnız kendi oluşturduğu sözleşmelere/);
    expect(description).toMatch(/kurumun izin ayarları bu kapsamı değiştirebilir/);
    expect(description).not.toContain('—');
  });
});
