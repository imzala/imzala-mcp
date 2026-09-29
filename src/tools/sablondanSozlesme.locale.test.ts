import { describe, expect, it, vi } from 'vitest';
import { partySchema } from './sablondanSozlesme.js';
import { makeClient } from '../client.js';

describe('sablondan_sozlesme_olustur locale', () => {
  it('opsiyonel: gonderilmezse gecerli (geriye uyum)', () => {
    expect(partySchema.safeParse({ template_party_id: 't1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' }).success).toBe(true);
  });
  it('tr/en kabul, digeri red', () => {
    const base = { template_party_id: 't1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' };
    expect(partySchema.safeParse({ ...base, locale: 'en' }).success).toBe(true);
    expect(partySchema.safeParse({ ...base, locale: 'de' }).success).toBe(false);
  });
});

describe('createDemand locale iletimi', () => {
  it('party_mapping[i].locale govdeye aynen gider, verilmeyen tarafa anahtar eklenmez', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true, data: { id: 'd1', signing_urls: [] } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({
      templateId: 't1',
      partyMapping: [
        { template_party_id: 'tp1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com', locale: 'en' },
        { template_party_id: 'tp2', first_name: 'Ayşe', last_name: 'Yılmaz', phone: '+905551112233' },
      ],
      send: false,
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.party_mapping[0].locale).toBe('en');
    expect('locale' in sent.party_mapping[1]).toBe(false);
  });
});
