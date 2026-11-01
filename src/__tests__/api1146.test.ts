import { describe, test, expect } from 'vitest';
import { formatTemplateDetail } from '../format.js';

// API 1.14.6 alignment: TemplateVariable.item_type `stamp` (sender stamp bridge).

describe('sablon_detay kaşe değişkeni', () => {
  test('stamp tipli değişkende düz metnin firma adı olduğu yazılır', () => {
    const out = formatTemplateDetail({
      id: 't1', name: 'Şablon', parties: [], documents: [],
      variables: [
        { slug: 'gonderen_kase', label: 'Kaşe', item_type: 'stamp', is_required: false, default_source: null },
        { slug: 'ad', label: 'Ad', item_type: 'text', is_required: true, default_source: null },
      ],
    } as never);
    expect(out).toMatch(/gonderen_kase \(Kaşe\), tip: stamp.*düz metin firma adı olarak yazılır/);
    expect(out).not.toMatch(/ad \(Ad\), tip: text.*firma adı/);
    expect(out).not.toContain('—');
  });
});
