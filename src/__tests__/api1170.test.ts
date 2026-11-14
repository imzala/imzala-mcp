import { describe, test, expect } from 'vitest';
import { errorFromBody } from '../client.js';
import type { DemandStatusResult, DemandListResult } from '../client.js';
import { formatError, formatBulkRowError, formatContractStatus, formatDemandList, contractNumbersText } from '../format.js';

// API 1.16.0 (PARTY_PHONE_MISSING) and 1.17.0 (contract_numbers, numaratör collision) alignment.

const DRAFT_ID = '9d08ed88-1234-5678-90ab-cdef12345678';
const PARTY_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const SEQ_ID = '2f8b6a41-7c3d-4e95-a0b2-5d1e9c7f3a68';

describe('PARTY_PHONE_MISSING (1.16.0)', () => {
  test('tek oluşturma (409): taslak kimliği, kredi ve davet yok, tekrar çağırma yasak, ham metin ve taraf kimliği yok', () => {
    const msg = formatError(errorFromBody(409, {
      success: false,
      code: 'PARTY_PHONE_MISSING',
      error: 'iç ayrıntı',
      party_ids: [PARTY_ID],
      data: { id: DRAFT_ID, status: 'DRAFT_UNDISPATCHED' },
    }));
    expect(msg).toMatch(/telefon numarası yok ya da geçersiz/);
    expect(msg).toMatch(/kredi düşülmedi, davet gönderilmedi/);
    expect(msg).toMatch(/tekrar ÇAĞIRMAYIN/);
    expect(msg).toMatch(/yalnız kullanıcı bunu açıkça isterse/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toContain(PARTY_ID);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/iptal edilemez|mevcut durumunda yapılamaz/);
    expect(msg).not.toContain('—');
  });

  test('kimliksiz (gönderim ya da satır): taslak kimliği uydurulmaz', () => {
    const msg = formatError(errorFromBody(409, { code: 'PARTY_PHONE_MISSING', party_ids: [PARTY_ID] }));
    expect(msg).toMatch(/Sözleşme gönderilmedi/);
    expect(msg).not.toMatch(/Taslak sözleşmenin kimliği/);
    expect(msg).not.toMatch(/tekrar ÇAĞIRMAYIN/);
  });

  test('toplu satır: aynı mesaj, taslak kimliği taşınır, ham metin yok', () => {
    const msg = formatBulkRowError({ row_index: 0, status: 'failed', error: 'PARTY_PHONE_MISSING', demand_id: DRAFT_ID, message: 'ham metin' } as never);
    expect(msg).toMatch(/telefon numarası/);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).not.toMatch(/ham metin/);
  });

  test('PHONE_REQUIRED_FOR_VERIFICATION mesajı değişmedi (ayrı kod)', () => {
    const msg = formatError(errorFromBody(400, { code: 'PHONE_REQUIRED_FOR_VERIFICATION' }));
    expect(msg).toMatch(/Sözleşme oluşturulmadı/);
  });
});

describe('CONTRACT_NUMBER_SEQUENCE_COLLISION (1.17.0)', () => {
  test('409 kimliksiz: numarayı ileri alma yönlendirmesi, ham metin yok, genel 409 metni değil', () => {
    const msg = formatError(errorFromBody(409, {
      success: false,
      code: 'CONTRACT_NUMBER_SEQUENCE_COLLISION',
      error: 'iç ayrıntı',
      message: 'iç ayrıntı',
    }));
    expect(msg).toMatch(/çakışıyor/);
    expect(msg).toMatch(/sıradaki numarayı ileri alın/);
    expect(msg).toMatch(/kredi düşülmedi, davet gönderilmedi/);
    expect(msg).not.toMatch(/Taslak sözleşmenin kimliği/);
    expect(msg).not.toMatch(/iç ayrıntı/);
    expect(msg).not.toMatch(/iptal edilemez|mevcut durumunda yapılamaz|kullanılabilir bir numaratör yok/);
    expect(msg).not.toContain('—');
  });

  test('toplu satır taslak kimliğiyle: tekrar çağırma yasak', () => {
    const msg = formatBulkRowError({ row_index: 2, status: 'failed', error: 'CONTRACT_NUMBER_SEQUENCE_COLLISION', demand_id: DRAFT_ID } as never);
    expect(msg).toContain(DRAFT_ID);
    expect(msg).toMatch(/tekrar ÇAĞIRMAYIN/);
  });
});

describe('contract_numbers (1.17.0)', () => {
  const STATUS: DemandStatusResult = {
    id: DRAFT_ID,
    title: 'Hizmet Sözleşmesi - Ayşe Yılmaz',
    status: 'PENDING',
    created_at: '2026-11-11T10:00:00.000Z',
    completed_at: null,
    parties: [],
    result_url: 'https://e.imzala.org/sonuc/x',
    pdf_url: null,
    contract_numbers: [{ sequence_id: SEQ_ID, value: 'ABC-2026-042' }],
  };

  test('sozlesme_durumu numarayı gösterir, numaratör kimliğini göstermez', () => {
    const out = formatContractStatus(STATUS);
    expect(out).toContain('Sözleşme numarası: ABC-2026-042');
    expect(out).not.toContain(SEQ_ID);
  });

  test('alan yoksa ya da boşsa satır yok (eski sürüm toleransı)', () => {
    expect(formatContractStatus({ ...STATUS, contract_numbers: [] })).not.toMatch(/Sözleşme numarası/);
    const { contract_numbers: _omit, ...older } = STATUS;
    expect(formatContractStatus(older as DemandStatusResult)).not.toMatch(/Sözleşme numarası/);
  });

  test('sozlesmelerim numarayı satırda gösterir', () => {
    const list: DemandListResult = {
      demands: [
        { id: DRAFT_ID, title: 'Kira', status: 'COMPLETED', created_at: '2026-11-11', completed_at: null, parties_total: 2, parties_signed: 2, pdf_url: null, contract_numbers: [{ sequence_id: SEQ_ID, value: 'ABC-2026-042' }, { sequence_id: SEQ_ID, value: 'ABC-2026-043' }] },
        { id: PARTY_ID, title: 'Numarasız', status: 'PENDING', created_at: '2026-11-11', completed_at: null, parties_total: 1, parties_signed: 0, pdf_url: null },
      ],
      total: 2, page: 1, limit: 20,
    };
    const out = formatDemandList(list);
    expect(out).toContain('sözleşme numarası: ABC-2026-042, ABC-2026-043');
    expect(out.split('\n').find((l) => l.includes('Numarasız'))).not.toMatch(/sözleşme numarası/);
  });

  test('bozuk girdiler atlanır, değer tek satıra indirilir ve kısaltılır', () => {
    expect(contractNumbersText(null)).toBeNull();
    expect(contractNumbersText('ABC')).toBeNull();
    expect(contractNumbersText([{ value: 42 }, null, { value: '  ' }])).toBeNull();
    expect(contractNumbersText([{ value: 'A\nB' }])).toBe('A B');
    expect(contractNumbersText([{ value: 'x'.repeat(80) }])).toHaveLength(48);
  });
});
