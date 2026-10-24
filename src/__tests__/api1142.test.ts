import { describe, test, expect, vi } from 'vitest';
import { makeClient, errorFromBody } from '../client.js';
import { formatError, formatReminderError } from '../format.js';
import { createServer } from '../server.js';

// API 1.14.2 alignment: the reminder endpoint's credit outcomes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string; handler: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

describe('hatirlatma_gonder kredi hataları', () => {
  test('402 INSUFFICIENT_CREDITS: tekrar deneme yok, kredi yükleyip daveti tekrar gönder, ham metin yok', () => {
    const msg = formatReminderError(errorFromBody(402, { success: false, error: { code: 'INSUFFICIENT_CREDITS', message: 'iç ayrıntı' } }));
    expect(msg).toMatch(/Hatırlatma gönderilmedi/);
    expect(msg).toMatch(/imzalama kredisi eksik/);
    expect(msg).toMatch(/tekrar denemeyin/);
    expect(msg).toMatch(/Kredi yükledikten sonra daveti panelden tekrar gönderin/);
    expect(msg).not.toMatch(/oluşturulmadı/); // not the contract-creation wording
    expect(msg).not.toMatch(/iç ayrıntı/);
  });

  test('500 CREDIT_CHECK_FAILED: nötr, geçici, ham metin yok', () => {
    const msg = formatReminderError(errorFromBody(500, { success: false, error: { code: 'CREDIT_CHECK_FAILED', message: 'iç ayrıntı' } }));
    expect(msg).toMatch(/Hatırlatma gönderilmedi/);
    expect(msg).toMatch(/kredi durumu şu anda doğrulanamadı/);
    expect(msg).toMatch(/geçici/);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/Sunucu hatası/);
  });

  test('diğer kodlar ortak hata metnine düşer', () => {
    const e = errorFromBody(429, { success: false, error: { code: 'RATE_LIMITED', message: 'x', retry_after_seconds: 200 } });
    expect(formatReminderError(e)).toBe(formatError(e));
  });

  test('araç 402 yanıtında küratörlü mesajı döner', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ success: false, error: { code: 'INSUFFICIENT_CREDITS', message: 'x' } }) });
    const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: fetchFn as unknown as typeof fetch });
    const tool = (server as unknown as PrivateServer)._registeredTools['hatirlatma_gonder'];
    const res = await tool.handler({ demand_id: 'dem_1' }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/imzalama kredisi eksik/);
    expect(tool.description).toMatch(/imzalama kredisi eksikse hatırlatma gönderilmez/);
    expect(tool.description).not.toContain('—');
  });

  test('istemci iç içe hata zarfını okur', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false, error: { code: 'CREDIT_CHECK_FAILED', message: 'x' } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.sendReminder({ demandId: 'dem_1' })).rejects.toMatchObject({ status: 500, code: 'CREDIT_CHECK_FAILED' });
  });
});
