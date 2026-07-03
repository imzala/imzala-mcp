#!/usr/bin/env node
/**
 * Pre-publish end-to-end gate for @imzala/mcp-server.
 *
 * WHY THIS EXISTS: v1.0.0–1.1.1 shipped a broken `eser_tescil` (every real
 * upload 500'd) because the unit tests + smoke tests used a FAKE API key and
 * never reached the real backend. This gate drives the ACTUAL built server
 * (dist/bin/stdio.js) over stdio, with a REAL API key against a REAL backend,
 * and asserts real tool output. It runs as part of `prepublishOnly`, so a
 * broken build can never be published again.
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
 *   IMZALA_E2E_SKIP=1               — escape hatch: skip the whole gate (loudly
 *                                     logged). Use only in a real emergency.
 */
import { spawn } from 'child_process';
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
function fail(m) { console.error(`${RED}  ✗ ${m}${RESET}`); process.exitCode = 1; throw new GateError(m); }
class GateError extends Error {}

if (process.env.IMZALA_E2E_SKIP === '1') {
  console.log(`${YELLOW}⚠ IMZALA_E2E_SKIP=1 — SKIPPING the MCP e2e pre-publish gate. Publishing UNVERIFIED.${RESET}`);
  process.exit(0);
}

const API_KEY = process.env.IMZALA_E2E_API_KEY;
const BASE_URL = process.env.IMZALA_E2E_BASE_URL || 'https://api-prd.imzala.org';

if (!API_KEY) {
  console.error(`${RED}✗ MCP e2e gate: IMZALA_E2E_API_KEY is not set.${RESET}`);
  console.error(`  This gate drives the real server against a real backend so a broken`);
  console.error(`  build cannot be published. Export a real key and retry:`);
  console.error(`${DIM}    export IMZALA_E2E_API_KEY=imz_...`);
  console.error(`    export IMZALA_E2E_BASE_URL=https://test-api.imzala.org   # optional, avoids prod credits`);
  console.error(`    npm publish${RESET}`);
  console.error(`  (Emergency-only bypass: IMZALA_E2E_SKIP=1 — publishes UNVERIFIED.)`);
  process.exit(1);
}

/** Drive the built stdio server: send initialize + a batch of tools/call, collect responses by id. */
function driveServer(calls) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, IMZALA_API_KEY: API_KEY, IMZALA_API_BASE_URL: BASE_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const responses = new Map();
    let buf = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('e2e timeout (60s)')); }, 60_000);

    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id != null) responses.set(msg.id, msg);
      }
      // Resolve once every requested id has a response.
      if (calls.every((c) => responses.has(c.id))) {
        clearTimeout(timer);
        child.stdin.end();
        child.kill('SIGTERM');
        resolve(responses);
      }
    });
    child.stderr.on('data', () => { /* diagnostics only; never on stdout */ });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });

    // Handshake, then all calls.
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } } }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 100, method: 'tools/list' }) + '\n');
    for (const c of calls) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: c.id, method: 'tools/call', params: { name: c.name, arguments: c.args } }) + '\n');
    }
  });
}

const text = (msg) => msg?.result?.content?.[0]?.text ?? '';
const isErr = (msg) => msg?.result?.isError === true;

async function main() {
  console.log(`\n${GREEN}▶ MCP e2e pre-publish gate${RESET}  ${DIM}(base: ${BASE_URL})${RESET}`);

  // Build the call batch. whoami + sablonlarim are key-only; the rest chain.
  const EXPECTED_TOOLS = ['eser_tescil', 'imzali_pdf_indir', 'sablon_detay', 'sablonlarim', 'sozlesme_durumu', 'whoami'];

  // --- Round 1: whoami + sablonlarim (discover a template id for round 2) ---
  const r1 = await driveServer([
    { id: 1, name: 'whoami', args: {} },
    { id: 2, name: 'sablonlarim', args: {} },
  ]);

  // tools/list
  const tools = (r1.get(100)?.result?.tools ?? []).map((t) => t.name).sort();
  if (EXPECTED_TOOLS.some((t) => !tools.includes(t))) fail(`tools/list missing tools. got: ${tools.join(',')}`);
  ok(`tools/list — 6 tools present (${tools.join(', ')})`);

  // whoami
  const who = r1.get(1);
  if (isErr(who) || !/Hesap:/.test(text(who)) || !/[Kk]redi/.test(text(who))) fail(`whoami failed: ${text(who).slice(0, 120)}`);
  ok('whoami — account + credit returned');

  // sablonlarim
  const list = r1.get(2);
  if (isErr(list)) fail(`sablonlarim failed: ${text(list).slice(0, 120)}`);
  const templateId = (text(list).match(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/) || [])[1];
  ok(`sablonlarim — template list returned${templateId ? ` (found ${templateId.slice(0, 8)}…)` : ' (no templates)'}`);

  // --- Round 2: sablon_detay + eser_tescil (+ optional demand tools) ---
  const round2 = [];
  if (templateId) round2.push({ id: 3, name: 'sablon_detay', args: { template_id: templateId } });

  let tsFile;
  const skipTs = process.env.IMZALA_E2E_SKIP_TIMESTAMP === '1';
  if (!skipTs) {
    const dir = mkdtempSync(join(tmpdir(), 'imzala-mcp-e2e-'));
    tsFile = join(dir, 'e2e-preflight.txt');
    writeFileSync(tsFile, `imzala mcp e2e preflight ${new Date().toISOString()}\n`);
    round2.push({ id: 4, name: 'eser_tescil', args: { file_path: tsFile, file_name: 'e2e-preflight.txt', description: 'mcp e2e gate' } });
  }

  const demandId = process.env.IMZALA_E2E_DEMAND_ID;
  if (demandId) round2.push({ id: 5, name: 'sozlesme_durumu', args: { demand_id: demandId } });

  const completedDemandId = process.env.IMZALA_E2E_COMPLETED_DEMAND_ID;
  let pdfPath;
  if (completedDemandId) {
    const dir = mkdtempSync(join(tmpdir(), 'imzala-mcp-e2e-pdf-'));
    pdfPath = join(dir, 'e2e.pdf');
    round2.push({ id: 6, name: 'imzali_pdf_indir', args: { demand_id: completedDemandId, save_path: pdfPath } });
  }

  const r2 = round2.length ? await driveServer(round2) : new Map();

  if (templateId) {
    const det = r2.get(3);
    if (isErr(det) || !/Şablon:/.test(text(det))) fail(`sablon_detay failed: ${text(det).slice(0, 120)}`);
    ok('sablon_detay — template detail + variables returned');
  } else {
    warn('sablon_detay — skipped (account has no templates)');
  }

  if (skipTs) {
    warn('eser_tescil — skipped (IMZALA_E2E_SKIP_TIMESTAMP=1)');
  } else {
    const ts = r2.get(4);
    // THE regression this gate exists for: a real file must produce a real stamp.
    if (isErr(ts) || !/KAMU SM|zaman damgas|dogrula|doğrula/i.test(text(ts))) {
      fail(`eser_tescil failed (the exact v1.0.0 DOA bug): ${text(ts).slice(0, 200)}`);
    }
    ok('eser_tescil — real RFC3161 timestamp created');
  }

  if (demandId) {
    const st = r2.get(5);
    if (isErr(st) || !/Sözleşme:/.test(text(st))) fail(`sozlesme_durumu failed: ${text(st).slice(0, 120)}`);
    ok('sozlesme_durumu — contract status returned');
    if (/undefined/.test(text(st))) fail('sozlesme_durumu output contains "undefined" (masked-field tolerant-read regression)');
  } else {
    info('sozlesme_durumu — skipped (set IMZALA_E2E_DEMAND_ID to test)');
  }

  if (completedDemandId) {
    const pdf = r2.get(6);
    if (isErr(pdf) || !/kaydedildi|base64/i.test(text(pdf))) fail(`imzali_pdf_indir failed: ${text(pdf).slice(0, 120)}`);
    ok('imzali_pdf_indir — signed PDF downloaded');
  } else {
    info('imzali_pdf_indir — skipped (set IMZALA_E2E_COMPLETED_DEMAND_ID to test)');
  }

  console.log(`${GREEN}✔ MCP e2e gate passed — safe to publish.${RESET}\n`);
}

main().catch((e) => {
  if (!(e instanceof GateError)) console.error(`${RED}✗ MCP e2e gate error: ${e.message}${RESET}`);
  console.error(`${RED}✘ MCP e2e gate FAILED — publish aborted.${RESET}\n`);
  process.exit(1);
});
