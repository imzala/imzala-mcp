import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatReminder } from '../format.js';

const RES = {
  demand_id: 'dem_1', demand_status: 'PENDING',
  channels_requested: ['sms', 'email'],
  reminders_sent: 1, reminders_skipped: 1,
  details: [
    { party_id: 'p1', first_name: 'Ahmet', last_name: 'Yılmaz', sms: { status: 'sent' }, email: { status: 'sent' } },
    { party_id: 'p2', first_name: 'Ayşe', last_name: 'Demir', sms: { status: 'skipped', reason: 'party_sms_cap_reached (3)' } },
  ],
};
function okFetch(body: unknown) { return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }); }

describe('sendReminder', () => {
  test('POSTs /demands/:id/reminders with channels + force', async () => {
    const fetchFn = okFetch({ success: true, data: RES });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.sendReminder({ demandId: 'dem_1', channels: ['sms'], force: true });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands/dem_1/reminders');
    const body = JSON.parse(opts.body as string);
    expect(body.channels).toEqual(['sms']);
    expect(body.force).toBe(true);
  });

  test('surfaces nested error envelope (429 RATE_LIMITED)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ success: false, error: { code: 'RATE_LIMITED', message: 'Çok sık', retry_after_seconds: 200 } }) });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await expect(c.sendReminder({ demandId: 'dem_1' })).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  });
});

describe('formatReminder', () => {
  test('shows sent/skipped counts + per-party', () => {
    const out = formatReminder(RES as never);
    expect(out).toMatch(/1.*gönderildi/);
    expect(out).toMatch(/1.*atlandı|1.*gönderilmedi/);
    expect(out).toContain('Ahmet Yılmaz');
    expect(out).toContain('Ayşe Demir');
  });
});
