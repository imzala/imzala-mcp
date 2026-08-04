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
  ['downloadPdf', (c) => c.downloadPdf('https://x/sonuc/d1/pdf')],
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
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonOk()));
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await invoke(c);
  expect(fetchMock).toHaveBeenCalled();
  for (const [, init] of fetchMock.mock.calls) {
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe(EXPECTED_UA);
  }
});

test('downloadPdf keyfî URL çeker — User-Agent GİDER, X-API-Key GİTMEZ (anahtar sızıntısı kilidi)', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('pdf', { status: 200 }));
  const c = makeClient({ apiKey: 'imz_x', baseUrl: 'https://x', fetch: fetchMock as any });
  await c.downloadPdf('https://elsewhere.example/file.pdf');
  const [, init] = fetchMock.mock.calls[0];
  const headers = init?.headers as Record<string, string>;
  expect(headers['User-Agent']).toBe(EXPECTED_UA);
  expect(headers['X-API-Key']).toBeUndefined();
});
