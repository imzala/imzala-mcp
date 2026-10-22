import { describe, test, expect, vi } from 'vitest';
import { createServer } from '../server.js';
import { errorFromBody } from '../client.js';
import { formatError, formatBulkRowError } from '../format.js';

// API 1.14.0 alignment: approver credit rule, verified-party lock and the
// DISPATCH_PREPARATION_FAILED code on create and bulk rows.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

const DRAFT_ID = '9d08ed88-1234-5678-90ab-cdef12345678';

function toolDescription(name: string): string {
  const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
  return (server as unknown as PrivateServer)._registeredTools[name].description ?? '';
}

describe('onaylayan kredisi araç açıklamalarında', () => {
  test.each(['sablondan_sozlesme_olustur', 'toplu_sozlesme_gonder'])('%s: kural koşuluyla anlatılır, mutlak "ücretsiz" yok', (name) => {
    const desc = toolDescription(name);
    expect(desc).toMatch(/en az bir imzacı varsa taraf sırasına göre ilk 3 onaylayan için kredi düşülmez/);
    expect(desc).toMatch(/4\. ve sonraki onaylayanlar için yalnız doğrulama yöntemlerinin kredisi düşülür \(imza ve koruma seviyesi kredisi düşülmez\)/);
    expect(desc).toMatch(/imzacı yoksa onaylayanlar imzacı gibi ücretlendirilir/);
    expect(desc).toMatch(/yeniden gönderim kredi kullanır/);
    expect(desc.toLocaleLowerCase('tr')).not.toMatch(/ücretsiz/);
    expect(desc).not.toContain('—');
  });
});

describe('DISPATCH_PREPARATION_FAILED', () => {
  test('tek oluşturma (500): taslak var, kredi düşülmedi, tekrar çağırma yasak, ham metin yok', () => {
    const msg = formatError(errorFromBody(500, {
      success: false,
      error: 'iç ayrıntı',
      code: 'DISPATCH_PREPARATION_FAILED',
      data: { id: DRAFT_ID, status: 'DRAFT_UNDISPATCHED' },
    }));
    expect(msg).toMatch(/TASLAK olarak oluşturuldu/);
    expect(msg).toMatch(/kredi henüz düşülmedi/);
    expect(msg).toMatch(/Kredi, taslak gönderildiğinde düşülür/);
    expect(msg).toMatch(/davet gönderilmedi/);
    expect(msg).toMatch(/tekrar ÇAĞIRMAYIN/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/Sunucu hatası/);
  });

  test('toplu satır: aynı mesaj, taslak kimliği taşınır, ham metin yok', () => {
    const msg = formatBulkRowError({ row_index: 0, status: 'failed', error: 'DISPATCH_PREPARATION_FAILED', demand_id: DRAFT_ID, message: 'ham metin' } as never);
    expect(msg).toMatch(/TASLAK olarak oluşturuldu/);
    expect(msg).toMatch(/kredi henüz düşülmedi/);
    expect(msg).toMatch(/Kredi, taslak gönderildiğinde düşülür/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toMatch(/ham metin/);
  });
});

describe('doğrulanmış taraf kilidi (409 VERIFIED_PARTY_*)', () => {
  test.each([
    ['VERIFIED_PARTY_CONTACT_LOCKED', /iletişim ve kimlik bilgileri değiştirilemez/],
    ['VERIFIED_PARTY_ROLE_LOCKED', /rolü değiştirilemez/],
    ['VERIFIED_PARTY_NOT_REMOVABLE', /sözleşmeden çıkarılamaz/],
  ])('%s: tekrar deneme yok, iptal ve yeniden gönderim kredi kullanır', (code, what) => {
    const msg = formatError(errorFromBody(409, { message: 'iç ayrıntı', code }));
    expect(msg).toMatch(what);
    expect(msg).toMatch(/tekrar denemeyin/);
    expect(msg).toMatch(/iptal edilip doğru bilgilerle yeniden gönderilmelidir/);
    expect(msg).toMatch(/yeniden gönderim kredi kullanır/);
    expect(msg).toMatch(/açık onayı olmadan/);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/mevcut durumunda yapılamaz/); // not the generic 409 text
  });
});
