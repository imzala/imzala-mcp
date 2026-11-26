import { describe, test, expect } from 'vitest';
import { formatDemandTimeline, formatTemplateDetail } from '../format.js';

// API 1.17.1-1.17.5 alignment: computed day-count field (days_between) and
// document-collection timeline events.

describe('sozlesme_audit belge toplama olayları (1.17.5)', () => {
  test.each([
    ['DOCUMENT_REVIEW', /Belge kontrolü/],
    ['DOCUMENT_UPLOADED', /Taraf istenen belgeyi yükledi/],
    ['DOCUMENT_APPROVED', /Yüklenen belge kabul edildi/],
    ['DOCUMENT_REJECTED', /Yüklenen belge kabul edilmedi/],
    ['DOCUMENT_NOTICE_SENT', /teslim bilgisi değildir/],
  ])('%s Türkçe gösterilir, ham kod görünmez', (eventType, label) => {
    const out = formatDemandTimeline({
      events: [{ id: 'e1', event_type: eventType, actor_label: null, ip_masked: null, comment_text: null, created_at: '2026-11-26T10:00:00Z' }],
    } as never);
    expect(out).toMatch(label);
    expect(out).not.toContain(eventType);
  });
});

describe('sablon_detay hesaplanan gün alanı (1.17.1/1.17.2)', () => {
  const detail = {
    id: 't1', name: 'Kira Sözleşmesi', description: null, category: null, usage_count: 0, pages_count: 1,
    parties: [{ id: 'tp1', order: 0, label: 'Kiracı', is_required: true }],
    variables: [
      { slug: 'sure_gun', label: 'Süre (gün)', item_type: 'dynamic_text', is_required: false, default_source: 'days_between:baslangic:bitis:business' },
      { slug: 'baslangic', label: 'Başlangıç', item_type: 'date', is_required: true, default_source: null },
    ],
  };

  test('days_between kaynağı işaretlenir, variables değerinin kullanılmadığı söylenir', () => {
    const out = formatTemplateDetail(detail as never);
    expect(out).toMatch(/sure_gun.*hesaplanan alan.*variables ile gönderilen değer kullanılmaz/);
  });

  test('diğer değişkenlerde hesaplanan alan notu yok', () => {
    const out = formatTemplateDetail(detail as never);
    const line = out.split('\n').find((l) => l.startsWith('- baslangic'));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/hesaplanan alan/);
  });
});
