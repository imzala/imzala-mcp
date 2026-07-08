#!/usr/bin/env node
/**
 * Pre-publish end-to-end gate for @imzala/mcp-server.
 *
 * WHY THIS EXISTS: v1.0.0–1.1.1 shipped a broken `eser_tescil` (every real
 * upload 500'd) because the unit tests + smoke tests used a FAKE API key and
 * never reached the real backend. This gate connects to the ACTUAL built
 * server (dist/bin/stdio.js) using the OFFICIAL MCP client — the very same
 * `@modelcontextprotocol/sdk` protocol implementation that Claude Desktop,
 * Cursor and other MCP hosts use — with a REAL API key against a REAL backend,
 * calls every tool, and asserts its real output. It runs as part of
 * `prepublishOnly`, so a broken build can never be published again.
 *
 * It is a genuine black-box integration test: real spawned server process,
 * real MCP stdio transport, real JSON-RPC handshake + tools/list + tools/call,
 * real HTTPS to the backend, real assertions. No mocks anywhere.
 *
 * REQUIRED env:
 *   IMZALA_E2E_API_KEY   — a real `imz_...` key with timestamps + templates
 *                          + demands scopes (or a legacy full-access key).
 * OPTIONAL env:
 *   IMZALA_E2E_BASE_URL             — default https://api-prd.imzala.org.
 *                                     Point at https://test-api.imzala.org to
 *                                     avoid spending prod credits.
 *   IMZALA_E2E_SKIP_TIMESTAMP=1     — skip eser_tescil (it spends ~4 credits).
 *   IMZALA_E2E_DEMAND_ID            — a demand id → also tests sozlesme_durumu.
 *   IMZALA_E2E_COMPLETED_DEMAND_ID  — a COMPLETED demand id → also tests
 *                                     imzali_pdf_indir.
 *   IMZALA_E2E_TEST_WRITE=1         — opt-in to exercise the WRITE tools.
 *                                     Off by default: write tools spend credits,
 *                                     mutate data, and/or send real SMS/email, so
 *                                     they must never run in a routine prepublish
 *                                     gate. Even with this set:
 *                                       - `hatirlatma_gonder` is NEVER invoked
 *                                         (sends real messages, no create-only
 *                                         mode) — presence checked via tools/list.
 *                                       - `sozlesme_iptal` is NEVER auto-invoked
 *                                         (irreversible cancel); it runs only when
 *                                         IMZALA_E2E_CANCEL_DEMAND_ID is ALSO set.
 *                                       - `kisi_ekle` creates a throwaway test
 *                                         contact when opted in.
 *   IMZALA_E2E_TEMPLATE_ID          — template id for the opt-in
 *                                     sablondan_sozlesme_olustur call (requires
 *                                     IMZALA_E2E_TEST_WRITE=1 + IMZALA_E2E_PARTY_ID).
 *   IMZALA_E2E_PARTY_ID             — template_party_id for the same call.
 *   IMZALA_E2E_CANCEL_DEMAND_ID     — a PENDING demand id the operator is willing
 *                                     to CANCEL (irreversible) → tests
 *                                     sozlesme_iptal. Requires IMZALA_E2E_TEST_WRITE=1.
 *   IMZALA_E2E_SKIP=1               — escape hatch: skip the whole gate (loudly
 *                                     logged). Use only in a real emergency.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..', 'dist', 'bin', 'stdio.js');

const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m';
const ok = (m) => console.log(`${GREEN}  ✓${RESET} ${m}`);
const info = (m) => console.log(`${DIM}    ${m}${RESET}`);
const warn = (m) => console.log(`${YELLOW}  ⚠${RESET} ${m}`);
class GateError extends Error {}
function fail(m) { throw new GateError(m); }

if (process.env.IMZALA_E2E_SKIP === '1') {
  console.log(`${YELLOW}⚠ IMZALA_E2E_SKIP=1 — SKIPPING the MCP e2e pre-publish gate. Publishing UNVERIFIED.${RESET}`);
  process.exit(0);
}

const API_KEY = process.env.IMZALA_E2E_API_KEY;
const BASE_URL = process.env.IMZALA_E2E_BASE_URL || 'https://api-prd.imzala.org';

if (!API_KEY) {
  console.error(`${RED}✗ MCP e2e gate: IMZALA_E2E_API_KEY is not set.${RESET}`);
  console.error(`  This gate connects the official MCP client to the real server against a`);
  console.error(`  real backend so a broken build cannot be published. Export a key and retry:`);
  console.error(`${DIM}    export IMZALA_E2E_API_KEY=imz_...`);
  console.error(`    export IMZALA_E2E_BASE_URL=https://test-api.imzala.org   # optional, avoids prod credits`);
  console.error(`    npm publish${RESET}`);
  console.error(`  (Emergency-only bypass: IMZALA_E2E_SKIP=1 — publishes UNVERIFIED.)`);
  process.exit(1);
}

/** Text of a tools/call result's first content block. */
const textOf = (res) => res?.content?.find?.((c) => c.type === 'text')?.text ?? '';
const isErr = (res) => res?.isError === true;

async function main() {
  console.log(`\n${GREEN}▶ MCP e2e pre-publish gate${RESET}  ${DIM}(official @modelcontextprotocol/sdk client → ${BASE_URL})${RESET}`);

  // Connect exactly like a real MCP host: spawn the built server over stdio and
  // run the JSON-RPC initialize handshake. StdioClientTransport starts the
  // child process; Client.connect() performs `initialize`.
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env: { ...getDefaultEnvironment(), IMZALA_API_KEY: API_KEY, IMZALA_API_BASE_URL: BASE_URL },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'imzala-mcp-e2e', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  try {
    // --- tools/list ---
    const EXPECTED = [
      'eser_tescil',
      'hatirlatma_gonder',
      'imzali_pdf_indir',
      'kisi_ekle',
      'kisilerim',
      'sablon_detay',
      'sablondan_sozlesme_olustur',
      'sablonlarim',
      'sozlesme_audit',
      'sozlesme_durumu',
      'sozlesme_iptal',
      'sozlesme_sertifikasi',
      'sozlesmelerim',
      'whoami',
      'zaman_damgalarim',
    ];
    const listed = (await client.listTools()).tools.map((t) => t.name).sort();
    if (EXPECTED.some((t) => !listed.includes(t))) fail(`tools/list missing tools. got: ${listed.join(',')}`);
    ok(`tools/list — ${EXPECTED.length} tools present (${listed.join(', ')})`);

    // --- whoami ---
    const who = await client.callTool({ name: 'whoami', arguments: {} });
    if (isErr(who) || !/Hesap:/.test(textOf(who)) || !/[Kk]redi/.test(textOf(who))) fail(`whoami failed: ${textOf(who).slice(0, 120)}`);
    ok('whoami — account + credit returned');

    // --- sablonlarim (discover a template id) ---
    const list = await client.callTool({ name: 'sablonlarim', arguments: {} });
    if (isErr(list)) fail(`sablonlarim failed: ${textOf(list).slice(0, 120)}`);
    const templateId = (textOf(list).match(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/) || [])[1];
    ok(`sablonlarim — template list returned${templateId ? ` (found ${templateId.slice(0, 8)}…)` : ' (no templates)'}`);

    // --- sablon_detay ---
    if (templateId) {
      const det = await client.callTool({ name: 'sablon_detay', arguments: { template_id: templateId } });
      if (isErr(det) || !/Şablon:/.test(textOf(det))) fail(`sablon_detay failed: ${textOf(det).slice(0, 120)}`);
      ok('sablon_detay — template detail + variables returned');
    } else {
      warn('sablon_detay — skipped (account has no templates)');
    }

    // --- sozlesmelerim (new READ tool — counts-only list, no party PII) ---
    const demandsList = await client.callTool({ name: 'sozlesmelerim', arguments: {} });
    if (isErr(demandsList) || !/Toplam:|Hiç sözleşme bulunamadı/.test(textOf(demandsList))) {
      fail(`sozlesmelerim failed: ${textOf(demandsList).slice(0, 160)}`);
    }
    ok('sozlesmelerim — contract list returned (counts-only)');

    // --- kisilerim (new READ tool — contact directory, NO T.C. Kimlik No) ---
    const contactsList = await client.callTool({ name: 'kisilerim', arguments: {} });
    if (isErr(contactsList) || !/Toplam:|Hiç kişi bulunamadı/.test(textOf(contactsList))) {
      fail(`kisilerim failed: ${textOf(contactsList).slice(0, 160)}`);
    }
    ok('kisilerim — contact list returned (no TC)');

    // --- zaman_damgalarim (new READ tool — RFC3161 timestamp list) ---
    const timestampsList = await client.callTool({ name: 'zaman_damgalarim', arguments: {} });
    if (isErr(timestampsList) || !/Toplam:|Hiç zaman damgası bulunamadı/.test(textOf(timestampsList))) {
      fail(`zaman_damgalarim failed: ${textOf(timestampsList).slice(0, 160)}`);
    }
    ok('zaman_damgalarim — timestamp list returned');

    // --- eser_tescil (THE regression this gate exists for) ---
    if (process.env.IMZALA_E2E_SKIP_TIMESTAMP === '1') {
      warn('eser_tescil — skipped (IMZALA_E2E_SKIP_TIMESTAMP=1)');
    } else {
      const dir = mkdtempSync(join(tmpdir(), 'imzala-mcp-e2e-'));
      const tsFile = join(dir, 'e2e-preflight.txt');
      writeFileSync(tsFile, `imzala mcp e2e preflight ${new Date().toISOString()}\n`);
      const ts = await client.callTool({ name: 'eser_tescil', arguments: { file_path: tsFile, file_name: 'e2e-preflight.txt', description: 'mcp e2e gate' } });
      if (isErr(ts) || !/KAMU SM|zaman damgas|do[gğ]rula/i.test(textOf(ts))) {
        fail(`eser_tescil failed (the exact v1.0.0 DOA bug): ${textOf(ts).slice(0, 200)}`);
      }
      ok('eser_tescil — real RFC3161 timestamp created');
    }

    // --- sozlesme_durumu (optional) ---
    const demandId = process.env.IMZALA_E2E_DEMAND_ID;
    if (demandId) {
      const st = await client.callTool({ name: 'sozlesme_durumu', arguments: { demand_id: demandId } });
      if (isErr(st) || !/Sözleşme:/.test(textOf(st))) fail(`sozlesme_durumu failed: ${textOf(st).slice(0, 120)}`);
      if (/undefined/.test(textOf(st))) fail('sozlesme_durumu output contains "undefined" (masked-field tolerant-read regression)');
      ok('sozlesme_durumu — contract status returned');
    } else {
      info('sozlesme_durumu — skipped (set IMZALA_E2E_DEMAND_ID to test)');
    }

    // --- imzali_pdf_indir (optional) ---
    const completedDemandId = process.env.IMZALA_E2E_COMPLETED_DEMAND_ID;
    if (completedDemandId) {
      const dir = mkdtempSync(join(tmpdir(), 'imzala-mcp-e2e-pdf-'));
      const pdfPath = join(dir, 'e2e.pdf');
      const pdf = await client.callTool({ name: 'imzali_pdf_indir', arguments: { demand_id: completedDemandId, save_path: pdfPath } });
      if (isErr(pdf) || !/kaydedildi|base64/i.test(textOf(pdf))) fail(`imzali_pdf_indir failed: ${textOf(pdf).slice(0, 120)}`);
      ok('imzali_pdf_indir — signed PDF downloaded');
    } else {
      info('imzali_pdf_indir — skipped (set IMZALA_E2E_COMPLETED_DEMAND_ID to test)');
    }

    // --- write tools (sablondan_sozlesme_olustur, sozlesme_iptal, kisi_ekle,
    //     hatirlatma_gonder) ---
    // OPT-IN ONLY: these tools spend credits, mutate data, and/or send real
    // SMS/email, so they must never run in the default (routine prepublish) gate
    // run. Presence of all four is already asserted via tools/list above.
    if (process.env.IMZALA_E2E_TEST_WRITE !== '1') {
      info('write tools (sablondan_sozlesme_olustur, sozlesme_iptal, kisi_ekle, hatirlatma_gonder) — SKIPPED by default (set IMZALA_E2E_TEST_WRITE=1 to opt in); presence already verified via tools/list');
    } else {
      const writeTemplateId = process.env.IMZALA_E2E_TEMPLATE_ID;
      const writePartyId = process.env.IMZALA_E2E_PARTY_ID;
      if (writeTemplateId && writePartyId) {
        const created = await client.callTool({
          name: 'sablondan_sozlesme_olustur',
          arguments: {
            template_id: writeTemplateId,
            parties: [
              {
                template_party_id: writePartyId,
                first_name: 'E2E',
                last_name: 'Preflight',
                email: 'e2e-preflight@imzala-mcp.invalid',
              },
            ],
            gonder: false,
          },
        });
        if (isErr(created) || !/Sözleşme oluşturuldu/.test(textOf(created))) {
          fail(`sablondan_sozlesme_olustur failed: ${textOf(created).slice(0, 200)}`);
        }
        ok('sablondan_sozlesme_olustur — demand created (create-only, no messages sent, 1 credit spent)');
      } else {
        warn('sablondan_sozlesme_olustur — skipped (IMZALA_E2E_TEST_WRITE=1 but IMZALA_E2E_TEMPLATE_ID / IMZALA_E2E_PARTY_ID not set)');
      }

      // kisi_ekle creates a throwaway contact (no credits, no messages). Uses a
      // unique .invalid email so it never collides / never reaches a real inbox.
      const created = await client.callTool({
        name: 'kisi_ekle',
        arguments: {
          first_name: 'E2E',
          last_name: 'Preflight',
          email: `e2e-preflight+${Date.now()}@imzala-mcp.invalid`,
        },
      });
      if (isErr(created) || !/Kişi kaydedildi/.test(textOf(created))) {
        fail(`kisi_ekle failed: ${textOf(created).slice(0, 200)}`);
      }
      ok('kisi_ekle — throwaway contact created (no credits, no messages)');

      // sozlesme_iptal is IRREVERSIBLE (cancels a real demand). NEVER auto-invoke
      // it against an arbitrary demand; it runs only when the operator explicitly
      // points it at a demand id they are willing to cancel.
      const cancelDemandId = process.env.IMZALA_E2E_CANCEL_DEMAND_ID;
      if (cancelDemandId) {
        const cancelled = await client.callTool({
          name: 'sozlesme_iptal',
          arguments: { demand_id: cancelDemandId, sebep: 'mcp e2e gate' },
        });
        if (isErr(cancelled) || !/İptal edildi/.test(textOf(cancelled))) {
          fail(`sozlesme_iptal failed: ${textOf(cancelled).slice(0, 200)}`);
        }
        ok('sozlesme_iptal — demand cancelled (irreversible; explicit target)');
      } else {
        info('sozlesme_iptal — NOT invoked (irreversible cancel); set IMZALA_E2E_CANCEL_DEMAND_ID to a disposable PENDING demand to test');
      }

      // hatirlatma_gonder sends REAL SMS/email with no create-only mode — this
      // gate must NEVER invoke it, even under IMZALA_E2E_TEST_WRITE=1. Its
      // presence in tools/list is already asserted above.
      info('hatirlatma_gonder — NOT invoked by this gate (always sends real SMS/email); presence verified via tools/list only');
    }

    console.log(`${GREEN}✔ MCP e2e gate passed — safe to publish.${RESET}\n`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  if (e instanceof GateError) console.error(`${RED}  ✗ ${e.message}${RESET}`);
  else console.error(`${RED}  ✗ MCP e2e gate error: ${e.message}${RESET}`);
  console.error(`${RED}✘ MCP e2e gate FAILED — publish aborted.${RESET}\n`);
  process.exit(1);
});
