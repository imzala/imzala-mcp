import { describe, test, expect, vi } from 'vitest';
import { z } from 'zod';
import { partySchema } from '../tools/sablondanSozlesme.js';
import { topluSozlesmeGonderInputSchema } from '../tools/topluSozlesmeGonder.js';
import { makeClient, errorFromBody } from '../client.js';
import { formatError, formatBulkRowError } from '../format.js';

// API 1.12.0 alignment: per-party phone verification
// (party_mapping[i].require_phone_verification) and its two error codes.

const party = { template_party_id: 'tp1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' };
const NO_CREATE = /oluşturulmadı/;

describe('parties[].require_phone_verification', () => {
  test('opsiyonel (geriye uyum); true, false ve null kabul, diğer değer red', () => {
    expect(partySchema.safeParse(party).success).toBe(true);
    for (const v of [true, false, null]) {
      expect(partySchema.safeParse({ ...party, phone: '+905551112233', require_phone_verification: v }).success).toBe(true);
    }
    expect(partySchema.safeParse({ ...party, require_phone_verification: 'evet' }).success).toBe(false);
  });

  test('toplu gönderim aynı taraf şemasını kullanır', () => {
    const schema = z.object(topluSozlesmeGonderInputSchema);
    const row = (p: Record<string, unknown>) => ({ template_id: 't1', rows: [{ party_mapping: [p] }] });
    expect(schema.safeParse(row({ ...party, require_phone_verification: true })).success).toBe(true);
    expect(schema.safeParse(row({ ...party, require_phone_verification: 'evet' })).success).toBe(false);
  });

  test('alan gövdeye aynen gider, verilmeyen tarafa anahtar eklenmez', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true, data: { id: 'd1', signing_urls: [] } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({
      templateId: 't1',
      partyMapping: [
        { ...party, phone: '+905551112233', require_phone_verification: true },
        { template_party_id: 'tp2', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' },
      ],
      send: false,
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.party_mapping[0].require_phone_verification).toBe(true);
    expect('require_phone_verification' in sent.party_mapping[1]).toBe(false);
  });
});

describe('telefon doğrulaması hata kodları', () => {
  test('PHONE_REQUIRED_FOR_VERIFICATION: küratörlü mesaj, ham metin ve taraf kimliği basılmaz', () => {
    const msg = formatError(errorFromBody(400, {
      success: false,
      code: 'PHONE_REQUIRED_FOR_VERIFICATION',
      error: 'party_mapping[0].phone iç ayrıntı',
      party_ids: ['11111111-1111-1111-1111-111111111111'],
    }));
    expect(msg).toMatch(/telefon numarası boş/);
    expect(msg).toMatch(NO_CREATE);
    expect(msg).toMatch(/kredi düşülmedi/);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/11111111/);
    expect(msg).not.toMatch(/doğrulamadan geçmedi/); // not swallowed by the generic 400 branch
  });

  test('INVALID_PHONE_VERIFICATION: küratörlü mesaj', () => {
    const msg = formatError(errorFromBody(400, { success: false, code: 'INVALID_PHONE_VERIFICATION', error: 'iç ayrıntı' }));
    expect(msg).toMatch(/require_phone_verification/);
    expect(msg).toMatch(NO_CREATE);
    expect(msg).not.toMatch(/iç ayrıntı/);
  });

  test.each(['PHONE_REQUIRED_FOR_VERIFICATION', 'INVALID_PHONE_VERIFICATION'])('toplu gönderim satırı (%s): aynı mesaj, ham metin yok', (code) => {
    const msg = formatBulkRowError({ row_index: 0, status: 'failed', error: code, message: 'ham metin' } as never);
    expect(msg).toMatch(/[Tt]elefon doğrulaması/);
    expect(msg).toMatch(NO_CREATE);
    expect(msg).not.toMatch(/ham metin/);
  });
});

describe('telefon doğrulaması yönlendirmesi', () => {
  test('PHONE_REQUIRED_FOR_VERIFICATION önce telefon ister, kaldırmayı yalnız açık istekle söyler', () => {
    const msg = formatError(errorFromBody(400, { success: false, code: 'PHONE_REQUIRED_FOR_VERIFICATION', error: 'x' }));
    expect(msg).toMatch(/Önce kullanıcıdan o tarafın telefon numarasını isteyin/);
    expect(msg).toMatch(/yalnız kullanıcı bunu açıkça isterse/);
  });

  test('alan açıklaması false için açık istek şartını söyler', () => {
    expect(partySchema.shape.require_phone_verification.description).toMatch(/false yalnız onaylayan tarafta etkilidir/);
    expect(partySchema.shape.require_phone_verification.description).toMatch(/açıkça istemedikçe false göndermeyin/);
  });
});
