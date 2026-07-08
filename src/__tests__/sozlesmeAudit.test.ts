import { describe, test, expect, vi } from 'vitest';
import { makeClient } from '../client.js';
import { formatDemandTimeline } from '../format.js';

const TIMELINE = {
  events: [
    { id: 'e1', event_type: 'demand.created', actor_label: 'Ahmet Y.', ip_masked: '85.34.12.x', comment_text: null, created_at: '2026-07-01T10:00:00.000Z', metadata: {} },
    { id: 'e2', event_type: 'party.viewed', actor_label: 'a***@x.com', ip_masked: '85.34.12.x', comment_text: null, created_at: '2026-07-01T10:05:00.000Z', metadata: {} },
    { id: 'e3', event_type: 'party.signed', actor_label: 'a***@x.com', ip_masked: '85.34.12.x', comment_text: 'onaylıyorum', created_at: '2026-07-01T10:06:00.000Z', metadata: {} },
    { id: 'e4', event_type: 'demand.completed', actor_label: null, ip_masked: null, comment_text: null, created_at: '2026-07-01T10:06:30.000Z', metadata: {} },
    { id: 'e5', event_type: 'weird.future_type', actor_label: null, ip_masked: null, comment_text: null, created_at: '2026-07-01T10:07:00.000Z', metadata: {} },
  ],
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('getDemandTimeline', () => {
  test('GETs /api/v1/demands/:id/timeline with encoded id', async () => {
    const fetchFn = mockFetchOk({ success: true, data: TIMELINE });
    const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://api-prd.imzala.org', fetch: fetchFn as unknown as typeof fetch });
    await c.getDemandTimeline('dmd 1/x');
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api-prd.imzala.org/api/v1/demands/dmd%201%2Fx/timeline');
    expect(opts).toEqual({ method: 'GET', headers: { 'X-API-Key': 'imz_x' } });
  });
});

describe('formatDemandTimeline', () => {
  test('renders Turkish event types + masked actor/IP + comment', () => {
    const out = formatDemandTimeline(TIMELINE as never);
    expect(out).toContain('Sözleşme oluşturuldu');
    expect(out).toContain('Taraf görüntüledi');
    expect(out).toContain('Taraf imzaladı');
    expect(out).toContain('Sözleşme tamamlandı');
    expect(out).toContain('Ahmet Y.');
    expect(out).toContain('IP 85.34.12.x');
    expect(out).toContain('not: onaylıyorum');
    // unknown event type falls back to raw (forward compat)
    expect(out).toContain('weird.future_type');
    // no em dash in user-visible output (AI-signature rule)
    expect(out).not.toContain('—');
  });

  test('empty timeline', () => {
    const out = formatDemandTimeline({ events: [] } as never);
    expect(out).toContain('henüz denetim kaydı yok');
  });
});
