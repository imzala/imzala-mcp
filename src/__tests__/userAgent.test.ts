import { test, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { makeClient } from '../client.js';

const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };
const EXPECTED_UA = `imzala-mcp/${pkg.version}`;

const jsonOk = () =>
  new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });

// Her public client metodu için bir çağrı. Aşağıdaki eksiksizlik testi bu listeyi
// makeClient yüzeyiyle kilitler — yeni metot eklenip buraya eklenmezse test kırılır
// (UA'sız yeni endpoint sessizce giremez).
const CALLS: Array<[string, (c: ReturnType<typeof makeClient>) => Promise<unknown>]> = [
  ['getMe', (c) => c.getMe()],
  ['getReports', (c) => c.getReports()],
  ['createTimestamp', (c) => c.createTimestamp({ fileBuffer: Buffer.from('x'), fileName: 'a.pdf' })],
  ['getDemand', (c) => c.getDemand('d1')],
  ['listTemplates', (c) => c.listTemplates()],
  ['getTemplate', (c) => c.getTemplate('t1')],
  ['downloadSignedPdf', (c) => c.downloadSignedPdf('d1')],
  ['downloadCertificate', (c) => c.downloadCertificate('d1')],
  ['createDemand', (c) => c.createDemand({ templateId: 't1', partyMapping: [], send: false })],
  ['sendReminder', (c) => c.sendReminder({ demandId: 'd1' })],
  ['listDemands', (c) => c.listDemands()],
  ['cancelDemand', (c) => c.cancelDemand('d1')],
  ['deleteDemand', (c) => c.deleteDemand('d1')],
  ['listContacts', (c) => c.listContacts()],
  ['createContact', (c) => c.createContact({ first_name: 'A', last_name: 'B' })],
  ['listTimestamps', (c) => c.listTimestamps()],
  ['getDemandTimeline', (c) => c.getDemandTimeline('d1')],
  ['bulkCreateDemands', (c) => c.bulkCreateDemands({ template_id: 't1', rows: [] })],
];

test('CALLS listesi client yüzeyinin tamamını kapsıyor (yeni metot → buraya da ekle)', () => {
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: vi.fn() as any });
  expect(CALLS.map(([n]) => n).sort()).toEqual(Object.keys(c).sort());
});

test.each(CALLS)('%s → her istek User-Agent: imzala-mcp/<version> taşır', async (_name, invoke) => {
  // PDF uçları yalnız gerçek PDF gövdesini kabul eder; diğerleri JSON zarfı bekler.
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    Promise.resolve(/\/(pdf|certificate)$/.test(url) ? new Response('%PDF-1.7', { status: 200 }) : jsonOk()));
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await invoke(c);
  expect(fetchMock).toHaveBeenCalled();
  for (const [, init] of fetchMock.mock.calls) {
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe(EXPECTED_UA);
  }
});

test('downloadSignedPdf yalnız baseUrl altındaki v1 ucuna gider; kimlikler yol parçası olarak kodlanır (anahtar başka adrese gitmez)', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('%PDF-1.7', { status: 200 })));
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await c.downloadSignedPdf('../../elsewhere.example/a', 'doc/../b');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://x/api/v1/demands/..%2F..%2Felsewhere.example%2Fa/belge/doc%2F..%2Fb/pdf');
  expect((init?.headers as Record<string, string>)['User-Agent']).toBe(EXPECTED_UA);
  // İstemcide keyfi URL çeken bir yardımcı kalmadı.
  expect('downloadPdf' in c).toBe(false);
});
