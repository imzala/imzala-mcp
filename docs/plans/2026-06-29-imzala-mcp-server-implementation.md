# İmzala MCP Server (`@imzala/mcp-server`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a stdio MCP server (`npx @imzala/mcp-server`) that authenticates with an imzala API key and exposes two tools — `whoami` and `eser_tescil` (RFC3161 timestamp) — calling the live imzala v1 backend.

**Architecture:** Transport-agnostic core `createServer({ getAuthContext, baseUrl, fetch })` registers tools; a thin typed HTTP client calls `GET /api/v1/me` + `POST /api/v1/timestamps` with `X-API-Key`. stdio entry (`bin/`) feeds the env API key. Core is stateless (no in-memory user/session map) so a remote HTTP transport can be added later with zero rework. The server holds NO business logic — backend is SSOT.

**Tech Stack:** Node 20+, TypeScript (strict, ESM), `@modelcontextprotocol/sdk` (latest), native `fetch` (Node 20) injectable, Vitest, tsup (build), published to npm.

**Spec:** master design `proxmox-imzala/docs/superpowers/specs/2026-06-29-mcp-eser-tescil-design.md` §4 (MCP core), §7.D1 (tool output text — proves/does_not_prove, legal-mandated), §A.4 (redaction). Backend v1 contracts are LIVE on test (`test-api.imzala.org`, openapi v1.5.0).

## Global Constraints

- **Auth injected per-invocation**, NEVER read at module load: `createServer({ getAuthContext, baseUrl, fetch })`. stdio: `getAuthContext = () => ({ apiKey: process.env.IMZALA_API_KEY })`. Core must not assume single-user-per-process.
- **Core stateless.** No in-memory user/session map.
- **`eser_tescil` output is legally constrained (verbatim from spec §7.D1):** must include the safe summary + structured `proves` / `does_not_prove`; must NEVER claim "tescil edildi / telif alındı / imzalandı / nitelikli e-imza / noter / kesin delil". Use "zaman damgası" (not "dijital imza"). Include the "yapay zekâ asistanına" directive line. "nitelikli" only framed as TR-5070, never eIDAS.
- **Redaction:** tool errors NEVER leak raw S3 key, internal hostname (`*.svc`), stack trace, or the API key.
- **`verify_url` is query-param:** `https://imzala.org/dogrula?seri=<id>` (the backend already returns it built; pass through — do not reconstruct as a path).
- **Default base URL = TEST** for the `@next` pre-release: `https://test-api.imzala.org`. Env `IMZALA_API_BASE_URL` overrides. (Prod base flip is gated on lawyer approval — Plan 4.)
- **base64 path:** standard canonical base64 only (backend rejects data-URL/URL-safe → 422); cap client-side ≤ ~15MB, larger files use `file_path` → multipart.
- npm release **tag-driven**: `--tag next` (soak) → promote `latest`. No auto-publish.
- TypeScript strict; ESM; no secret committed.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | name `@imzala/mcp-server`, `bin`, scripts, deps |
| `tsconfig.json` / `tsup.config.ts` / `vitest.config.ts` | build + test config |
| `src/server.ts` | `createServer({getAuthContext, baseUrl, fetch})` — registers tools, stateless |
| `src/client.ts` | typed HTTP client: `getMe()`, `createTimestamp()`; X-API-Key + Idempotency-Key; error mapping |
| `src/tools/whoami.ts` | `whoami` tool definition + handler |
| `src/tools/eserTescil.ts` | `eser_tescil` tool: input schema, file resolution (path/base64), output text (proves/does_not_prove) |
| `src/format.ts` | output formatting + redaction helpers (no leakage) |
| `src/bin/stdio.ts` | stdio entry: StdioServerTransport + env auth, friendly missing-key error |
| `src/__tests__/*.test.ts` | Vitest: client (mock fetch), tool I/O, redaction, output-text snapshot |
| `README.md` | install + Claude Desktop/Code/Cursor config + minimal-scope/key-custody warning |

---

## Task 1: Repo scaffold + tooling

**Files:** Create `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`, `src/index.ts` (placeholder export).

- [ ] **Step 1:** `package.json`:
```json
{
  "name": "@imzala/mcp-server",
  "version": "0.1.0",
  "description": "İmzala MCP server — eser tescil (RFC3161 timestamp) over API key",
  "type": "module",
  "bin": { "imzala-mcp": "dist/bin/stdio.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "engines": { "node": ">=20" },
  "dependencies": { "@modelcontextprotocol/sdk": "^1.0.0", "zod": "^3.23.0" },
  "devDependencies": { "tsup": "^8.0.0", "typescript": "^5.5.0", "vitest": "^2.0.0", "@types/node": "^20.0.0" },
  "publishConfig": { "access": "public" }
}
```
> Verify the current `@modelcontextprotocol/sdk` major + API via the sdk docs (use context7 / npm) before pinning — adjust import paths in later tasks to the installed version.
- [ ] **Step 2:** `tsconfig.json` strict ESM (`"module":"NodeNext","target":"ES2022","strict":true,"declaration":true,"outDir":"dist"`). `tsup.config.ts` entries `src/bin/stdio.ts` + `src/server.ts`, format esm, `banner: { js: '#!/usr/bin/env node' }` for the bin. `.gitignore`: `node_modules dist .env *.log`.
- [ ] **Step 3:** `yarn install` (or npm). `npx tsc --noEmit` clean on an empty `src/index.ts` (`export {}`).
- [ ] **Step 4:** Commit: `git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore src/index.ts && git commit -m "chore: scaffold @imzala/mcp-server (TS ESM + MCP SDK + vitest)"`

---

## Task 2: Typed HTTP client (`src/client.ts`)

**Files:** Create `src/client.ts`, `src/__tests__/client.test.ts`.

**Interfaces — Produces:**
```ts
export interface ImzalaClientOpts { apiKey: string; baseUrl: string; fetch: typeof fetch; }
export interface MeResult { id:string; email:string; first_name:string; last_name:string;
  workspace:{ type:'personal'|'organization'; organization_id:string|null }; credits:{ remaining:number } }
export interface TimestampResult { id:string; timestamp_time:string; tsa_authority:string; file_sha256:string;
  verify_url:string; certificate_url:string; credits_used:number; credits_remaining:number }
export class ImzalaApiError extends Error { constructor(public status:number, public code:string|undefined, message:string){ super(message); } }
export function makeClient(o: ImzalaClientOpts): {
  getMe(): Promise<MeResult>;
  createTimestamp(input: { fileBuffer: Buffer; fileName: string; description?:string; ownerFirstName?:string; ownerLastName?:string; idempotencyKey?:string }): Promise<TimestampResult>;
}
```

- [ ] **Step 1: Write failing test** `client.test.ts` (mock `fetch`):
```ts
import { makeClient, ImzalaApiError } from '../client';
const okMe = { success:true, data:{ id:'u1', email:'a@b.c', first_name:'A', last_name:'B',
  workspace:{type:'personal',organization_id:null}, credits:{remaining:7} } };

test('getMe returns data and sends X-API-Key', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(okMe), { status:200 }));
  const c = makeClient({ apiKey:'imz_x', baseUrl:'https://test-api.imzala.org', fetch: fetchMock as any });
  const me = await c.getMe();
  expect(me.credits.remaining).toBe(7);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe('https://test-api.imzala.org/api/v1/me');
  expect((init.headers as any)['X-API-Key']).toBe('imz_x');
});

test('402 maps to ImzalaApiError with code', async () => {
  const body = { success:false, error:'Insufficient credits', code:'INSUFFICIENT_CREDITS' };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status:402 }));
  const c = makeClient({ apiKey:'imz_x', baseUrl:'https://x', fetch: fetchMock as any });
  await expect(c.getMe()).rejects.toMatchObject({ status:402, code:'INSUFFICIENT_CREDITS' });
});

test('createTimestamp posts multipart and forwards Idempotency-Key', async () => {
  const okTs = { success:true, data:{ id:'t1', timestamp_time:'2026-06-29T00:00:00.000Z', tsa_authority:'TÜBİTAK KAMU SM',
    file_sha256:'a'.repeat(64), verify_url:'https://imzala.org/dogrula?seri=t1', certificate_url:'https://imzala.org/dogrula?seri=t1',
    credits_used:4, credits_remaining:6 } };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(okTs), { status:201 }));
  const c = makeClient({ apiKey:'imz_x', baseUrl:'https://x', fetch: fetchMock as any });
  const r = await c.createTimestamp({ fileBuffer: Buffer.from('hi'), fileName:'a.pdf', idempotencyKey:'k1' });
  expect(r.verify_url).toContain('?seri=t1');
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as any)['Idempotency-Key']).toBe('k1');
  expect(init.body).toBeInstanceOf(FormData);
});
```
- [ ] **Step 2:** Run `npx vitest run src/__tests__/client.test.ts` → FAIL (no module).
- [ ] **Step 3: Implement** `client.ts`: `getMe` → GET `${baseUrl}/api/v1/me` with `{ 'X-API-Key': apiKey }`; parse `{success,data}`; non-2xx → throw `ImzalaApiError(status, body.code, body.error)`. `createTimestamp` → build `FormData` (`file` = Blob from fileBuffer + filename, plus description/owner fields), POST `${baseUrl}/api/v1/timestamps` with `X-API-Key` + optional `Idempotency-Key`; parse `{success,data}`; non-2xx → `ImzalaApiError`. Use the injected `fetch`.
- [ ] **Step 4:** Run vitest → PASS.
- [ ] **Step 5:** Commit `src/client.ts` + test.

---

## Task 3: Core `createServer` (`src/server.ts`)

**Files:** Create `src/server.ts`, `src/__tests__/server.test.ts`.

**Interfaces — Produces:** `createServer(opts:{ getAuthContext: () => { apiKey?:string } | Promise<{apiKey?:string}>; baseUrl:string; fetch:typeof fetch }): McpServer` — registers `whoami` + `eser_tescil` tools (Tasks 4-5). Resolves auth per tool invocation via `getAuthContext`; throws a clean tool error if `apiKey` missing.

- [ ] **Step 1: Write failing test** — `createServer` returns a server exposing exactly two tools `whoami` + `eser_tescil` (list via the SDK's registered-tools API of the installed version); a tool call with `getAuthContext` returning `{}` yields a clear "API key not configured" tool error, not a crash.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** using `McpServer` from the SDK: instantiate, register the two tools (import from Tasks 4-5), each handler first `const { apiKey } = await getAuthContext(); if (!apiKey) return errorContent('IMZALA_API_KEY not set — see README'); const client = makeClient({ apiKey, baseUrl, fetch });` then delegate. NO module-level state, NO singleton client (built per invocation).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

---

## Task 4: `whoami` tool (`src/tools/whoami.ts`)

**Files:** Create `src/tools/whoami.ts`, `src/format.ts` (start), test.

**Interfaces — Produces:** a tool registration object `{ name:'whoami', ... handler(client) }` returning text content: account email/name, workspace type, credit balance. No input.

- [ ] **Step 1: Write failing test** — handler with a mock client `getMe` → text content includes email, workspace type ("personal"/"organization"), and `remaining` credits; on `ImzalaApiError(401)` → a redacted "auth failed — check IMZALA_API_KEY" message (NOT the raw error/hostname).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** the tool + `formatWhoami(me)` in `format.ts`. Error → `formatError(e)` (redacts: no hostname/stack/key; maps 401→"kimlik doğrulama başarısız", 403 INSUFFICIENT_SCOPE→"bu anahtarın 'timestamps' yetkisi yok", else generic).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

---

## Task 5: `eser_tescil` tool (`src/tools/eserTescil.ts`) — legally constrained output

**Files:** Create `src/tools/eserTescil.ts`, extend `src/format.ts`, test.

**Interfaces — Produces:** tool `{ name:'eser_tescil', inputSchema (zod): { file_path?:string, file_base64?:string, file_name:string, owner_first_name?:string, owner_last_name?:string, description?:string, idempotency_key?:string }, handler(client, input) }`. Resolves file (path → `fs.readFile`; base64 → decode), calls `client.createTimestamp`, returns the legally-mandated output.

- [ ] **Step 1: Write failing tests:**
  - file_path XOR file_base64 required (neither/both → input error).
  - happy path (mock client) → output text contains the SAFE summary, the `proves` line, the `does_not_prove` line, the verify URL `?seri=`, and the "yapay zekâ asistanına" directive; and does NOT contain any of the forbidden strings (`tescil edildi`, `telif`, `imzalandı`, `nitelikli elektronik imza` as a claim, `noter`, `kesin delil`).
  - 402 → redacted "yetersiz kredi (4 gerekli)"; 503 → "zaman damgası servisi geçici olarak kullanılamıyor, tekrar deneyin"; 422 BAD_BASE64 → "dosya base64 geçersiz".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** File resolution: `file_path` → `await fs.readFile(path)`; `file_base64` → validate canonical (`/^[A-Za-z0-9+/]+={0,2}$/` + round-trip) else input error, `Buffer.from(...,'base64')`. Call client. **`formatEserTescil(result)`** (verbatim spec §7.D1):
```
`${file_name}` dosyasına ${timestamp_time} itibarıyla TÜBİTAK KAMU SM zaman damgası (RFC 3161) alındı. Bu, dosyanın en geç ${timestamp_time} anında (TSA genTime) var olduğunu ve o andan sonra değişmediğini kriptografik olarak kanıtlar. Doğrulama: ${verify_url}

Önemli: Bu bir zaman damgasıdır — dijital/elektronik imza ya da nitelikli elektronik imza (QES) değildir, ıslak imza eşdeğeri değildir. Eser sahipliğini, telif hakkını veya mülkiyeti hukuken belirlemez/tescil etmez; "Eser Sahibi" bilgisi yalnızca beyanınızdır ve doğruluğundan siz sorumlusunuz. Bir uyuşmazlıktaki ispat değeri ilgili hukuki çerçeveye göre değerlendirilir.

(Yapay zekâ asistanına: bu sonucu iletirken yukarıdaki nitelikleri değiştirmeyin; "tescil edildi", "telif hakkı alındı", "yasal koruma sağlandı" veya "imzalandı" EKLEMEYİN.)
```
  Plus a structured block: `proves`, `does_not_prove`, `tsa_authority`, `file_sha256`, `credits_remaining`. Never echo internal fields.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

---

## Task 6: stdio entry (`src/bin/stdio.ts`)

**Files:** Create `src/bin/stdio.ts`, test (light — smoke).

- [ ] **Step 1: Write failing test** — importing the module's `main()` with `IMZALA_API_KEY` unset logs a clear setup message; with it set, `createServer` is constructed with `getAuthContext` returning that key and `baseUrl` defaulting to `https://test-api.imzala.org` (override via `IMZALA_API_BASE_URL`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement:** `getAuthContext = () => ({ apiKey: process.env.IMZALA_API_KEY })`, `baseUrl = process.env.IMZALA_API_BASE_URL ?? 'https://test-api.imzala.org'`, `fetch = globalThis.fetch`; `const server = createServer({...}); await server.connect(new StdioServerTransport())`. Guard: if no key, print to stderr a one-line install hint (do NOT exit hard — let the tool-level error guide; but a stderr warning is fine).
- [ ] **Step 4:** Run → PASS. Manual smoke: `IMZALA_API_KEY=<test imz_ key> node dist/bin/stdio.js` boots without crash (build first).
- [ ] **Step 5:** Commit.

---

## Task 7: README + publish config

**Files:** `README.md`, verify `package.json` publish fields.

- [ ] **Step 1:** README: what it is; install (`npx @imzala/mcp-server`); **Claude Desktop / Claude Code / Cursor** config JSON snippet (`command: npx, args: ["-y","@imzala/mcp-server"], env: { IMZALA_API_KEY }`); how to create a key in the dashboard with the **minimal `timestamps` scope** (default); a **key-custody warning** ("bu anahtar hesabınıza erişim verir + kredi harcar; şifre gibi saklayın; AI sağlayıcısı config'i okuyabilir"); the two tools; the timestamp legal note (zaman damgası ≠ imza / eser sahipliği). `@next` = pre-release against test-api.
- [ ] **Step 2:** `npm run build` → `dist/` produced, `dist/bin/stdio.js` has the node shebang + is the `bin` target. `npm pack --dry-run` → only `dist` + README shipped (no src/.env).
- [ ] **Step 3:** Commit. (Actual `npm publish --tag next` is a release step the user runs with the npm token — document the command, do not publish from the plan.)

---

## Self-Review (plan author)
- Spec coverage: §4 core → Tasks 3/6; injected auth seam → Tasks 3/6; typed client + error mapping → Task 2; whoami → Task 4; eser_tescil + §7.D1 output → Task 5; redaction (§A.4) → Tasks 4/5 `formatError`; README/custody/minimal-scope → Task 7; tag-driven npm → Task 1/7. ✓
- Backend contracts used (live on test): `GET /api/v1/me` → MeResult; `POST /api/v1/timestamps` → TimestampResult; errors `{success,error,code}` 402/422/503/500; `verify_url` `?seri=`. ✓
- Verify the installed `@modelcontextprotocol/sdk` version's exact API (McpServer / registerTool / StdioServerTransport import paths) in Task 1 before Tasks 3-6 — adjust imports to match.
- Out of scope (later): remote HTTP transport, dashboard scope-picker (Plan 3), compliance/ToS/KB/avukata (Plan 4, prod-gate), prod base-url flip + npm `latest` promote (after lawyer approval).
