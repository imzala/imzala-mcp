import { describe, test, expect } from 'vitest';
import { errorFromBody } from '../client.js';
import type { DemandStatusResult } from '../client.js';
import { formatError, formatBulkRowError, formatContractStatus } from '../format.js';

// API 1.10.7 - 1.11.1 alignment: open-consent copies per signer
// (CONSENT_SINGLE_PARTY), Belge Toplama preflight codes and the
// VERIFICATION_CONTEXT_REQUIRED source code, result page hides consent.

const NO_CREATE = /oluşturulmadı/;

describe('CONSENT_SINGLE_PARTY', () => {
  test('tek sözleşme: kimliği korunur, oluşmadığı ve tekrar denenmemesi söylenir, ham metin basılmaz', () => {
    const msg = formatError(errorFromBody(400, { success: false, error: 'İç ayrıntı: zarf 23 belge', code: 'CONSENT_SINGLE_PARTY' }));
    expect(msg).toMatch(/açık rıza belgesi birden çok role atandığı/i);
    expect(msg).toMatch(NO_CREATE);
    expect(msg).toMatch(/kredi düşülmedi/);
    expect(msg).toMatch(/tekrar denemeyin/);
    expect(msg).not.toMatch(/İç ayrıntı/);
    expect(msg).not.toMatch(/doğrulamadan geçmedi/); // not swallowed by the generic 400 branch
  });

  test('toplu gönderim satırı: aynı küratörlü mesaj', () => {
    const msg = formatBulkRowError({ row_index: 0, status: 'failed', error: 'CONSENT_SINGLE_PARTY', message: 'ham metin' } as never);
    expect(msg).toMatch(/açık rıza belgesi birden çok role atandığı/i);
    expect(msg).not.toMatch(/ham metin/);
  });
});

describe('Belge Toplama ön kontrolü', () => {
  test.each([
    ['DOCUMENT_COLLECTION_TEMPLATE_REQUIRED', 400],
    ['DOCUMENT_COLLECTION_TEMPLATE_NOT_FOUND', 404],
    ['INVALID_DOCUMENT_COLLECTION_TIMING', 400],
    ['INVALID_DOCUMENT_COLLECTION_FLAG', 400],
  ])('%s: Belge Toplama mesajı, sözleşme oluşmadı', (code, status) => {
    const msg = formatError(errorFromBody(status, { success: false, error: 'serbest metin', code }));
    expect(msg).toMatch(/Belge Toplama/);
    expect(msg).toMatch(NO_CREATE);
    expect(msg).not.toMatch(/serbest metin/);
    expect(msg).not.toMatch(/Kayıt bulunamadı/); // 404 is not the generic "wrong id" text
  });

  test('VERIFICATION_CONTEXT_REQUIRED: error alanındaki kaynak kod izin listesindeyse taşınır', () => {
    const e = errorFromBody(400, { success: false, code: 'VERIFICATION_CONTEXT_REQUIRED', error: 'DOCUMENT_TYPE_INVALID' });
    expect(e.code).toBe('VERIFICATION_CONTEXT_REQUIRED');
    expect(e.sourceCode).toBe('DOCUMENT_TYPE_INVALID');
    const msg = formatError(e);
    expect(msg).toMatch(/DOCUMENT_TYPE_INVALID/);
    expect(msg).toMatch(/belge türü/);
    expect(msg).toMatch(NO_CREATE);
  });

  test('VERIFICATION_CONTEXT_REQUIRED: izin listesi dışındaki error değeri taşınmaz', () => {
    const e = errorFromBody(400, { success: false, code: 'VERIFICATION_CONTEXT_REQUIRED', error: 'Alıcı: Ayşe Yılmaz' });
    expect(e.sourceCode).toBeUndefined();
    const msg = formatError(e);
    expect(msg).not.toMatch(/Ayşe/);
    expect(msg).toMatch(/doğrulama ayarları geçersiz/);
  });

  test('prototip anahtarı kaynak kod olarak taşınmaz ve basılmaz', () => {
    for (const key of ['__proto__', 'constructor', 'toString']) {
      const e = errorFromBody(400, { success: false, code: 'VERIFICATION_CONTEXT_REQUIRED', error: key });
      expect(e.sourceCode).toBeUndefined();
      expect(formatError(e)).not.toMatch(/Sebep:/);
    }
  });

  test('biçimlendirici kaynak kodu yeniden doğrular', () => {
    const e = errorFromBody(400, { success: false, code: 'VERIFICATION_CONTEXT_REQUIRED', error: 'x' });
    (e as unknown as { sourceCode: string }).sourceCode = 'constructor';
    expect(formatError(e)).not.toMatch(/native code|Sebep:/);
  });

  test('kaynak kod yalnız VERIFICATION_CONTEXT_REQUIRED zarfında okunur', () => {
    const e = errorFromBody(400, { success: false, code: 'VALIDATION', error: 'DOCUMENT_TYPE_INVALID' });
    expect(e.sourceCode).toBeUndefined();
  });

  test('DOCUMENT_VERIFICATION_DISABLED (503) otomatik tekrarı önermez', () => {
    const msg = formatError(errorFromBody(503, { success: false, code: 'DOCUMENT_VERIFICATION_DISABLED', error: 'x' }));
    expect(msg).toMatch(/tekrar denemeyin/);
    expect(msg).not.toMatch(/biraz sonra tekrar deneyin/i);
  });
});

describe('sozlesme_durumu: açık rıza belgesi', () => {
  const base: DemandStatusResult = {
    id: 'd1', title: 'Kira Sözleşmesi', status: 'PENDING', created_at: '2026-10-18T10:00:00.000Z',
    completed_at: null, parties: [], result_url: 'https://e.imzala.org/sonuc/d1', pdf_url: null,
  };
  const doc = (id: string, order: number, doc_kind: string) => ({ id, order, title: `Belge ${order}`, doc_kind });

  test('rıza belgesi varsa sonuç sayfasında gösterilmediği söylenir', () => {
    const out = formatContractStatus({ ...base, documents: [doc('a', 1, 'CONTRACT'), doc('b', 2, 'KVKK_CONSENT')] });
    expect(out).toMatch(/Açık rıza belgesi sonuç sayfasında gösterilmez/);
  });

  test('rıza belgesi yoksa not eklenmez', () => {
    const out = formatContractStatus({ ...base, documents: [doc('a', 1, 'CONTRACT'), doc('b', 2, 'PREINFO')] });
    expect(out).not.toMatch(/Açık rıza belgesi sonuç sayfasında/);
  });
});
