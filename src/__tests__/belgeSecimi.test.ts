import { describe, test, expect, vi } from 'vitest';
import { makeClient, ImzalaApiError } from '../client.js';
import { formatError, formatTemplateDetail, formatBulkResult } from '../format.js';

const GENERIC_409 = 'Bu işlem sözleşmenin mevcut durumunda yapılamaz';

function errFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: false, status, json: async () => body });
}
function okFetch(body: unknown, status = 201) {
  return vi.fn().mockResolvedValue({ ok: true, status, json: async () => body });
}
function client(fetchFn: unknown) {
  return makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as typeof fetch });
}
const ONE_PARTY = [{ template_party_id: 'tp1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' }];
const CREATED = {
  id: 'dem_1', title: 'Hizmet Sözleşmesi', status: 'PENDING', template_id: 't1',
  signing_urls: [], result_url: 'https://e.imzala.org/sonuc/dem_1', variables_applied: [], dispatched: 0,
};

describe('parseErrorBody — 1.8.17 structured fields', () => {
  test('carries details (reason + document_ids) from a 400 body', async () => {
    const fetchFn = errFetch(400, {
      error: 'Belge seçimi geçersiz', code: 'INVALID_DOCUMENT_SELECTION',
      details: { reason: 'unknown_document', document_ids: ['doc-9'] },
    });
    await expect(client(fetchFn).createDemand({ templateId: 't1', partyMapping: ONE_PARTY, send: false }))
      .rejects.toMatchObject({ status: 400, code: 'INVALID_DOCUMENT_SELECTION', details: { reason: 'unknown_document', document_ids: ['doc-9'] } });
  });

  test('carries template_party_ids from a 409 body', async () => {
    const fetchFn = errFetch(409, { error: 'x', code: 'PARTY_WITHOUT_DOCUMENTS', template_party_ids: ['tp2'] });
    await expect(client(fetchFn).createDemand({ templateId: 't1', partyMapping: ONE_PARTY, send: false }))
      .rejects.toMatchObject({ status: 409, code: 'PARTY_WITHOUT_DOCUMENTS', templatePartyIds: ['tp2'] });
  });

  test('a body without the new fields leaves them undefined (older API deployments)', async () => {
    const fetchFn = errFetch(404, { error: 'yok' });
    try {
      await client(fetchFn).createDemand({ templateId: 't1', partyMapping: ONE_PARTY, send: false });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ImzalaApiError).details).toBeUndefined();
      expect((e as ImzalaApiError).templatePartyIds).toBeUndefined();
    }
  });
});

describe('formatError — document selection codes get their OWN message', () => {
  test('PARTY_WITHOUT_DOCUMENTS is not the generic 409 text and names the role id', () => {
    const text = formatError(new ImzalaApiError(409, 'PARTY_WITHOUT_DOCUMENTS', 'raw backend message', { templatePartyIds: ['tp2'] }));
    expect(text).not.toContain(GENERIC_409);
    expect(text).toContain('tp2');
    expect(text).toContain('belge');
    expect(text).not.toContain('raw backend message');
  });

  test('FORM (c): no template_party_ids means the contract WAS created as a draft — warn, do not say "oluşturulmadı"', () => {
    const text = formatError(new ImzalaApiError(409, 'PARTY_WITHOUT_DOCUMENTS', 'x', { partyIds: ['p1'], demandId: 'dem_9', demandStatus: 'DRAFT_UNDISPATCHED' }));
    expect(text).not.toContain(GENERIC_409);
    expect(text).toContain('TASLAK');
    expect(text).toContain('dem_9');
    expect(text).toContain('ÇAĞIRMAYIN');
    expect(text).not.toContain('sözleşme oluşturulmadı');
  });

  test('FORM (a)/(b) and FORM (c) are different messages', () => {
    const notCreated = formatError(new ImzalaApiError(409, 'PARTY_WITHOUT_DOCUMENTS', 'x', { templatePartyIds: ['tp2'] }));
    const draft = formatError(new ImzalaApiError(409, 'PARTY_WITHOUT_DOCUMENTS', 'x', { partyIds: ['p1'] }));
    expect(notCreated).toContain('sözleşme oluşturulmadı');
    expect(notCreated).not.toContain('TASLAK');
    expect(draft).toContain('TASLAK');
    expect(draft).not.toContain('tp2');
  });

  test('TEMPLATE_DOCUMENTS_NOT_READY is not the generic 409 text', () => {
    const text = formatError(new ImzalaApiError(409, 'TEMPLATE_DOCUMENTS_NOT_READY', 'x'));
    expect(text).not.toContain(GENERIC_409);
    expect(text).toContain('hazır');
  });

  test('DOCUMENT_SOURCE_UNAVAILABLE is not the generic 409 text', () => {
    const text = formatError(new ImzalaApiError(409, 'DOCUMENT_SOURCE_UNAVAILABLE', 'x'));
    expect(text).not.toContain(GENERIC_409);
    expect(text).toContain('ilk belge');
  });

  test('INVALID_DOCUMENT_SELECTION: each reason gets a distinct message', () => {
    const mk = (reason: string, ids?: string[]) =>
      formatError(new ImzalaApiError(400, 'INVALID_DOCUMENT_SELECTION', 'x', { details: { reason, document_ids: ids } }));
    const unknown = mk('unknown_document', ['doc-9']);
    const conflict = mk('conflict', ['doc-3']);
    const empty = mk('empty');
    const shape = mk('shape');
    expect(unknown).toContain('doc-9');
    expect(unknown).toContain('ait olmayan');
    expect(conflict).toContain('doc-3');
    expect(conflict).toContain('hem include hem exclude');
    expect(empty).toContain('belge kalmadı');
    expect(shape).toContain('20 kimlik');
    const all = [unknown, conflict, empty, shape];
    expect(new Set(all).size).toBe(4);
    for (const t of all) expect(t).not.toContain(GENERIC_409);
  });

  test('INVALID_DOCUMENT_SELECTION without details still returns a document-selection message', () => {
    const text = formatError(new ImzalaApiError(400, 'INVALID_DOCUMENT_SELECTION', 'x'));
    expect(text).toContain('Belge seçimi');
  });

  test('a plain 409 (cancel conflict) keeps the existing generic message', () => {
    expect(formatError(new ImzalaApiError(409, 'DEMAND_NOT_CANCELLABLE', 'x'))).toContain(GENERIC_409);
  });
});

describe('createDemand — documents passthrough', () => {
  test('sends `documents` exactly as given', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    await client(fetchFn).createDemand({
      templateId: 't1', partyMapping: ONE_PARTY, send: false,
      documents: { include: ['doc-2'], exclude: ['doc-1'] },
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.documents).toEqual({ include: ['doc-2'], exclude: ['doc-1'] });
  });

  test('BACKWARD-COMPAT LOCK: without a selection the payload is byte-identical to the pre-1.8.17 request', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    await client(fetchFn).createDemand({
      templateId: 't1', partyMapping: ONE_PARTY, variables: { ucret: '1.000 TL' }, send: false,
    });
    const body = fetchFn.mock.calls[0][1].body as string;
    expect(body).toBe(JSON.stringify({
      template_id: 't1',
      party_mapping: ONE_PARTY,
      variables: { ucret: '1.000 TL' },
      dispatch_notifications: false,
    }));
    expect(body).not.toContain('documents');
  });

  test('bulk rows carry their own documents selection (per-row, never batch-level)', async () => {
    const fetchFn = okFetch({ success: true, data: { template_id: 't1', total: 1, created: 1, failed: 0, results: [] } }, 200);
    await client(fetchFn).bulkCreateDemands({
      template_id: 't1',
      options: { dispatch_notifications: false },
      rows: [{ party_mapping: ONE_PARTY, documents: { exclude: ['doc-1'] } }],
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.rows[0].documents).toEqual({ exclude: ['doc-1'] });
    expect(sent.options.documents).toBeUndefined();
  });
});

const DETAIL_BASE = {
  id: 't1', name: 'Hizmet Sözleşmesi', description: null, category: null, usage_count: 3,
  parties: [{ id: 'tp1', order: 0, label: 'Müşteri', is_required: true }],
  pages_count: 2,
  variables: [],
};

describe('formatTemplateDetail — documents', () => {
  test('renders each document with id, kind, default state and assigned roles', () => {
    const out = formatTemplateDetail({
      ...DETAIL_BASE,
      documents: [
        { id: 'doc-1', order: 1, title: 'Hizmet Sözleşmesi', doc_kind: 'CONTRACT', is_required: true, signature_required: true, default_included: true, assigned_template_party_ids: ['tp1'] },
        { id: 'doc-2', order: 2, title: 'Aydınlatma Metni', doc_kind: 'KVKK_NOTICE', is_required: false, signature_required: false, default_included: false, assigned_template_party_ids: [] },
      ],
    } as never);
    expect(out).toContain('doc-1');
    expect(out).toContain('Aydınlatma Metni');
    expect(out).toContain('CONTRACT');
    expect(out).toContain('documents.include');
    expect(out).toMatch(/doc-1.*varsayılan: gönderilir/s);
    expect(out).toMatch(/doc-2.*varsayılan: gönderilmez/s);
    expect(out).toContain('tp1');
    expect(out).toContain('atanmış rol yok');
  });

  test('TOLERANT READ: server omits `documents` entirely — no document section, rest still renders', () => {
    const out = formatTemplateDetail(DETAIL_BASE as never);
    expect(out).toContain('Hizmet Sözleşmesi');
    expect(out).toContain('template_party_id: tp1');
    expect(out).not.toContain('documents.include');
    expect(out).not.toContain('zarf belgesi');
  });

  test('empty documents array says the envelope has no separate documents', () => {
    const out = formatTemplateDetail({ ...DETAIL_BASE, documents: [] } as never);
    expect(out).toContain('zarf belgesi tanımlı değil');
  });
});

describe('formatBulkResult — failed rows never echo the server string', () => {
  const bulk = (row: Record<string, unknown>) => formatBulkResult({
    template_id: 't1', total: 1, created: 0, failed: 1,
    results: [{ row_index: 0, status: 'failed', ...row }],
  } as never, false);

  test('row PARTY_WITHOUT_DOCUMENTS (not created) names the role and drops the raw message', () => {
    const out = bulk({ error: 'PARTY_WITHOUT_DOCUMENTS', message: 'ham sunucu metni', template_party_ids: ['tp2'] });
    expect(out).toContain('tp2');
    expect(out).toContain('oluşturulmadı');
    expect(out).not.toContain('ham sunucu metni');
  });

  test('row PARTY_WITHOUT_DOCUMENTS after creation warns about the draft instead of "oluşturulmadı"', () => {
    const out = bulk({ error: 'PARTY_WITHOUT_DOCUMENTS', message: 'ham', party_ids: ['p1'], demand_id: 'dem_7' });
    expect(out).toContain('TASLAK');
    expect(out).toContain('dem_7');
    expect(out).not.toContain('ham');
  });

  test('row INVALID_DOCUMENT_SELECTION uses the reason-specific message', () => {
    const out = bulk({ error: 'INVALID_DOCUMENT_SELECTION', message: 'ham', details: { reason: 'conflict', document_ids: ['doc-3'] } });
    expect(out).toContain('hem include hem exclude');
    expect(out).toContain('doc-3');
    expect(out).not.toContain('ham');
  });

  test('a row with no error code degrades gracefully', () => {
    expect(bulk({ message: 'ham' })).toContain('Bilinmeyen hata');
  });
});

describe('empty document selection is dropped (byte-identity)', () => {
  test('documents: {} is not serialized on create', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    await client(fetchFn).createDemand({ templateId: 't1', partyMapping: ONE_PARTY, send: false, documents: {} });
    expect(fetchFn.mock.calls[0][1].body as string).not.toContain('documents');
  });

  test('documents with two empty lists is not serialized on create', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    await client(fetchFn).createDemand({ templateId: 't1', partyMapping: ONE_PARTY, send: false, documents: { include: [], exclude: [] } });
    expect(fetchFn.mock.calls[0][1].body as string).not.toContain('documents');
  });

  test('an empty row selection is dropped too, a real one survives', async () => {
    const fetchFn = okFetch({ success: true, data: { template_id: 't1', total: 2, created: 2, failed: 0, results: [] } }, 200);
    await client(fetchFn).bulkCreateDemands({
      template_id: 't1',
      rows: [{ party_mapping: ONE_PARTY, documents: {} }, { party_mapping: ONE_PARTY, documents: { include: ['doc-2'] } }],
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.rows[0].documents).toBeUndefined();
    expect(sent.rows[1].documents).toEqual({ include: ['doc-2'] });
  });
});

describe('creation-outcome codes on failed bulk rows', () => {
  const bulkRow = (row: Record<string, unknown>) => formatBulkResult({
    template_id: 't1', total: 1, created: 0, failed: 1,
    results: [{ row_index: 0, status: 'failed', ...row }],
  } as never, false);

  test('RECONCILE_FAILED says the draft exists and tells the model NOT to retry', () => {
    const out = bulkRow({ error: 'RECONCILE_FAILED', message: 'ham sunucu metni', demand_id: 'dem_5' });
    expect(out).toContain('TASLAK');
    expect(out).toContain('dem_5');
    expect(out).toContain('ÇAĞIRMAYIN');
    expect(out).not.toContain('ham sunucu metni');
    expect(out).not.toContain('kod: RECONCILE_FAILED');
  });

  test('RECONCILE_FAILED without demand_id keeps the warning, just cannot name the draft', () => {
    const out = bulkRow({ error: 'RECONCILE_FAILED' });
    expect(out).toContain('TASLAK');
    expect(out).toContain('ÇAĞIRMAYIN');
  });

  test('CREATE_FAILED gets its own message and does NOT invent a draft', () => {
    const out = bulkRow({ error: 'CREATE_FAILED', message: 'ham sunucu metni' });
    expect(out).toContain('oluşturulamadı');
    expect(out).toContain('sozlesmelerim');
    expect(out).not.toContain('TASLAK');
    expect(out).not.toContain('ham sunucu metni');
    expect(out).not.toContain('kod: CREATE_FAILED');
  });

  test('VALIDATION points at the checkable fields without echoing the server text', () => {
    const out = bulkRow({ error: 'VALIDATION', message: 'party_mapping[0].email gecersiz' });
    expect(out).toContain('doğrulamadan geçmedi');
    expect(out).toContain('template_party_id');
    expect(out).not.toContain('party_mapping[0].email gecersiz');
  });

  test('the three codes produce three different messages', () => {
    const texts = ['RECONCILE_FAILED', 'CREATE_FAILED', 'VALIDATION'].map((error) => bulkRow({ error }));
    expect(new Set(texts).size).toBe(3);
  });

  test('the same codes are worded identically on the single-create path', () => {
    const single = formatError(new ImzalaApiError(500, 'RECONCILE_FAILED', 'ham', { demandId: 'dem_5' }));
    expect(single).toContain('TASLAK');
    expect(single).toContain('dem_5');
    expect(single).not.toContain('ham');
  });
});
