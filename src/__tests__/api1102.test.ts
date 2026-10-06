import { describe, test, expect, vi } from 'vitest';
import { z } from 'zod';
import { partySchema } from '../tools/sablondanSozlesme.js';
import { topluSozlesmeGonderInputSchema } from '../tools/topluSozlesmeGonder.js';
import { createServer } from '../server.js';
import { makeClient, ImzalaApiError } from '../client.js';
import { formatError, formatReminder, formatDemandTimeline } from '../format.js';

// API 1.10.0 - 1.10.2 alignment: signer locale on create, INVALID_LOCALE,
// reminders_ineligible, REAPPROVAL_REQUIRED timeline event.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { handler: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

const party = { template_party_id: 'tp1', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com' };

describe('sablondan_sozlesme_olustur parties[].locale', () => {
  test('opsiyonel (geriye uyum), tr/en kabul, diğer değer red', () => {
    expect(partySchema.safeParse(party).success).toBe(true);
    expect(partySchema.safeParse({ ...party, locale: 'en' }).success).toBe(true);
    expect(partySchema.safeParse({ ...party, locale: 'tr' }).success).toBe(true);
    expect(partySchema.safeParse({ ...party, locale: 'de' }).success).toBe(false);
  });

  test('locale gövdeye aynen gider, verilmeyen tarafa anahtar eklenmez', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true, data: { id: 'd1', signing_urls: [] } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.createDemand({
      templateId: 't1',
      partyMapping: [
        { ...party, locale: 'en' },
        { template_party_id: 'tp2', first_name: 'Ayşe', last_name: 'Yılmaz', phone: '+905551112233' },
      ],
      send: false,
    });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.party_mapping[0].locale).toBe('en');
    expect('locale' in sent.party_mapping[1]).toBe(false);
  });
});

describe('toplu_sozlesme_gonder rows[].party_mapping[].locale', () => {
  const schema = z.object(topluSozlesmeGonderInputSchema);
  const rowWith = (p: Record<string, unknown>) => ({ template_id: 't1', rows: [{ party_mapping: [p] }] });

  test('tek-sözleşme aracıyla aynı taraf şeması', () => {
    expect(schema.safeParse(rowWith(party)).success).toBe(true);
    expect(schema.safeParse(rowWith({ ...party, locale: 'en' })).success).toBe(true);
    expect(schema.safeParse(rowWith({ ...party, locale: 'de' })).success).toBe(false);
    const { template_party_id: _omit, ...noRole } = party;
    expect(schema.safeParse(rowWith(noRole)).success).toBe(false);
  });

  test('locale ve API\'nin diğer taraf alanları gövdeye aynen iletilir', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { template_id: 't1', total: 1, created: 1, failed: 0, results: [] } }),
    });
    const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://test-api.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    const tools = (server as unknown as PrivateServer)._registeredTools;
    const parsed = schema.parse(rowWith({ ...party, locale: 'en', send_sms: false }));
    await tools['toplu_sozlesme_gonder'].handler(parsed, {});
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(sent.rows[0].party_mapping[0].locale).toBe('en');
    expect(sent.rows[0].party_mapping[0].send_sms).toBe(false);
  });
});

describe('INVALID_LOCALE', () => {
  test('küratörlü mesaj; ham sunucu metni basılmaz', () => {
    const text = formatError(new ImzalaApiError(400, 'INVALID_LOCALE', 'party_mapping[0].locale internal detail'));
    expect(text).toContain('tr veya en');
    expect(text).toContain('oluşturulmadı');
    expect(text).not.toContain('internal detail');
  });
});

describe('hatirlatma_gonder reminders_ineligible', () => {
  const base = { demand_id: 'dem_1', demand_status: 'PENDING', channels_requested: ['email'], reminders_sent: 0, reminders_skipped: 0, details: [] };

  test('sayı varsa gösterilir', () => {
    const out = formatReminder({ ...base, reminders_ineligible: 2 } as never);
    expect(out).toContain('2 taraf şu an hatırlatma almıyor');
    expect(out).not.toContain('—');
  });

  test('eski sürümde alan yoksa satır eklenmez', () => {
    expect(formatReminder(base as never)).not.toContain('hatırlatma almıyor');
  });

  test('party_not_eligible atlama gerekçesi gösterilir', () => {
    const out = formatReminder({
      ...base,
      reminders_skipped: 1,
      details: [{ party_id: 'p1', first_name: 'Ayşe', last_name: 'Yılmaz', email: { status: 'skipped', reason: 'party_not_eligible' } }],
    } as never);
    expect(out).toContain('party_not_eligible');
  });
});

describe('sozlesme_audit REAPPROVAL_REQUIRED', () => {
  test('Türkçe etiketle gösterilir', () => {
    const out = formatDemandTimeline({ events: [{ id: 'e1', event_type: 'REAPPROVAL_REQUIRED', actor_label: null, ip_masked: null, comment_text: null, created_at: '2026-10-06T10:00:00Z' }] });
    expect(out).toContain('yeniden onayı gerekiyor');
    expect(out).not.toContain('REAPPROVAL_REQUIRED');
  });
});
