import { describe, test, expect } from 'vitest';
import { errorFromBody } from '../client.js';
import { formatError, formatBulkRowError } from '../format.js';

// API 1.14.5 alignment: contract-number (numaratör) gate on create, bulk and dispatch.

const DRAFT_ID = '9d08ed88-1234-5678-90ab-cdef12345678';

describe('CONTRACT_NUMBER_SEQUENCE_UNAVAILABLE', () => {
  test('tek oluşturma (409): taslak kimliği, kredi ve davet yok, tekrar çağırma yasak, ham metin yok', () => {
    const msg = formatError(errorFromBody(409, {
      code: 'CONTRACT_NUMBER_SEQUENCE_UNAVAILABLE',
      error: 'iç ayrıntı',
      message: 'iç ayrıntı',
      data: { id: DRAFT_ID, status: 'DRAFT_UNDISPATCHED' },
    }));
    expect(msg).toMatch(/numaratör/);
    expect(msg).toMatch(/kredi düşülmedi, davet gönderilmedi/);
    expect(msg).toMatch(/tekrar ÇAĞIRMAYIN/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/mevcut durumunda yapılamaz/); // not the generic 409 text
    expect(msg).not.toContain('—');
  });

  test('gönderim (409, kimliksiz): taslak kimliği uydurulmaz', () => {
    const msg = formatError(errorFromBody(409, { code: 'CONTRACT_NUMBER_SEQUENCE_UNAVAILABLE' }));
    expect(msg).toMatch(/Sözleşme gönderilmedi/);
    expect(msg).not.toMatch(/Taslak sözleşmenin kimliği/);
  });

  test('toplu satır: aynı mesaj, taslak kimliği taşınır', () => {
    const msg = formatBulkRowError({ row_index: 0, status: 'failed', error: 'CONTRACT_NUMBER_SEQUENCE_UNAVAILABLE', demand_id: DRAFT_ID, message: 'ham metin' } as never);
    expect(msg).toMatch(/numaratör/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toMatch(/ham metin/);
  });
});
