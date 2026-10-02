import { describe, test, expect, vi } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { createServer } from '../server.js';

// API coverage gate. `spec/openapi.v1.public.yaml` is a copy of the backend's
// PUBLISHED OpenAPI document; `api-coverage.json` pins its version + hash and
// maps every operation to a tool or to a stated reason for leaving it out.
// When the API moves, `npm run spec:sync` refreshes the copy and this suite
// goes red until each new operation is classified, so the package cannot
// silently fall behind the API again.

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const specText = readFileSync(root('spec/openapi.v1.public.yaml'), 'utf8');
const coverage = JSON.parse(readFileSync(root('api-coverage.json'), 'utf8')) as {
  specVersion: string;
  specSha256: string;
  operations: Record<string, { tool?: string; excluded?: string }>;
};
const spec = parse(specText) as { info: { version: string }; paths: Record<string, Record<string, unknown>> };

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const specOps = Object.entries(spec.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`));

function registeredTools(): string[] {
  const server = createServer({ getAuthContext: () => ({ apiKey: 'imz_x' }), baseUrl: 'https://x', fetch: vi.fn() as unknown as typeof fetch });
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
}

describe('API coverage gate', () => {
  test('the pinned hash and version match the spec copy', () => {
    expect(createHash('sha256').update(specText).digest('hex')).toBe(coverage.specSha256);
    expect(spec.info.version).toBe(coverage.specVersion);
  });

  test('every operation in the spec is classified', () => {
    expect(specOps.filter((op) => !(op in coverage.operations))).toEqual([]);
  });

  test('no classified operation is missing from the spec', () => {
    expect(Object.keys(coverage.operations).filter((op) => !specOps.includes(op))).toEqual([]);
  });

  test('each entry names exactly one of: a registered tool, or a reason', () => {
    const tools = registeredTools();
    for (const [op, entry] of Object.entries(coverage.operations)) {
      expect(Boolean(entry.tool) !== Boolean(entry.excluded), op).toBe(true);
      if (entry.tool) expect(tools, op).toContain(entry.tool);
      // Reasons are customer-visible text in a public repository.
      if (entry.excluded) expect(entry.excluded.trim().length, op).toBeGreaterThan(10);
    }
  });

  test('every registered tool is backed by at least one operation', () => {
    const mapped = new Set(Object.values(coverage.operations).map((e) => e.tool).filter(Boolean));
    expect(registeredTools().filter((t) => !mapped.has(t))).toEqual([]);
  });

  test('the copy is the public derivative: no internal markers or infrastructure names', () => {
    for (const marker of ['x-internal', 'x-imzala-', 'svc.cluster.local', '.imzala.internal', 'BEGIN PRIVATE KEY']) {
      expect(specText.includes(marker), marker).toBe(false);
    }
  });
});
