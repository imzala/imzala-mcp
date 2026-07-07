import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatContactCreate, formatError } from '../format.js';
import { ImzalaApiError } from '../client.js';
import { kisiEkleInputSchema } from '../tools/kisiEkle.js';
import { createServer } from '../server.js';

const CREATED = {
  id: 'c9', first_name: 'Mehmet', last_name: 'Demir', email: 'mehmet@x.com', phone: null,
  job_title: 'Avukat', company_id: null, company: null, notes: null,
  address_country: 'TR', address_city: 'Ankara', address_district: 'Çankaya', address_line: 'Y cad',
  archived_at: null, created_at: '2026-07-07T00:00:00.000Z', updated_at: '2026-07-07T00:00:00.000Z',
};
function okFetch(body: unknown, status = 201) { return vi.fn().mockResolvedValue({ ok: true, status, json: async () => body }); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { description?: string }> };

describe('createContact', () => {
  test('POSTs /api/v1/contacts with only allowlist fields — NEVER government_id/TC', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createContact({
      first_name: 'Mehmet', last_name: 'Demir', email: 'mehmet@x.com', job_title: 'Avukat',
      address_country: 'TR', address_city: 'Ankara', address_district: 'Çankaya', address_line: 'Y cad',
    });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/contacts');
    expect(opts.method).toBe('POST');
    const sent = JSON.parse(opts.body as string);
    expect(sent.first_name).toBe('Mehmet');
    expect(sent.last_name).toBe('Demir');
    // 🔴 KVKK: no TC identifier of any spelling may be present in the request body.
    expect(sent).not.toHaveProperty('government_id');
    expect(sent).not.toHaveProperty('government_id_serial');
    expect(sent).not.toHaveProperty('tc');
    expect(sent).not.toHaveProperty('national_id');
  });

  test('omits optional fields that were not provided', async () => {
    const fetchFn = okFetch({ success: true, data: CREATED });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createContact({ first_name: 'A', last_name: 'B' });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent).toEqual({ first_name: 'A', last_name: 'B' });
  });

  test('throws ImzalaApiError with CONTACT_DUPLICATE on 409', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'zaten var', code: 'CONTACT_DUPLICATE', data: { id: 'c1' } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.createContact({ first_name: 'A', last_name: 'B', email: 'a@x.com' })).rejects.toMatchObject({ status: 409, code: 'CONTACT_DUPLICATE' });
  });
});

describe('kisi_ekle input schema', () => {
  test('does NOT expose any TC / government_id input field (KVKK)', () => {
    const keys = Object.keys(kisiEkleInputSchema);
    expect(keys).not.toContain('government_id');
    expect(keys).not.toContain('government_id_serial');
    expect(keys).not.toContain('tc');
    expect(keys).not.toContain('national_id');
    expect(keys).not.toContain('tc_kimlik');
    // sanity: the expected fields ARE present
    expect(keys).toContain('first_name');
    expect(keys).toContain('last_name');
  });
});

describe('formatContactCreate', () => {
  test('confirms record + explicit "records not verifies" wording', () => {
    const out = formatContactCreate(CREATED as never);
    expect(out).toContain('Kişi kaydedildi');
    expect(out).toContain('Mehmet Demir');
    expect(out).toMatch(/KAYDEDER/);
    expect(out).toMatch(/DOĞRULAMAZ/);
    expect(out).not.toContain('—');
  });
});

describe('formatError — contact duplicate', () => {
  test('409 CONTACT_DUPLICATE maps to a curated message, no id leak', () => {
    const out = formatError(new ImzalaApiError(409, 'CONTACT_DUPLICATE', 'zaten var'));
    expect(out).toMatch(/zaten var/);
    expect(out).toMatch(/kisilerim/);
  });
});

describe('kisi_ekle tool description', () => {
  const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
  const desc = (server as unknown as PrivateServer)._registeredTools['kisi_ekle'].description ?? '';

  test('records-not-verifies + AI consent + TC not accepted', () => {
    expect(desc).toMatch(/KAYDEDER/);
    expect(desc).toMatch(/DOĞRULAMAZ/);
    expect(desc).toMatch(/Yapay zeka asistanına/);
    expect(desc).toMatch(/KABUL EDİLMEZ/);
    expect(desc).not.toContain('—');
  });
});
