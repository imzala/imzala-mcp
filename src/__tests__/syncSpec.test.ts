import { describe, test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Build scripts run as ESM in Node, outside the TypeScript runtime bundle.
// @ts-expect-error JavaScript build script has no declaration file
import { readArtifact, parseArgs } from '../../scripts/sync-spec.mjs';
const text = 'openapi: 3.1.0\ninfo: {version: "1.10.3", title: API}\npaths: {}\n';
const hash = createHash('sha256').update(text).digest('hex');
function fixture(run: (file: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'imzala-public-artifact-')); const file = join(dir, 'openapi.v1.public.yaml');
  try { writeFileSync(file, text); run(file); } finally { rmSync(dir, { recursive: true, force: true }); }
}
describe('explicit local public artifact source', () => {
  test('default invocation retains remote mode', () => expect(parseArgs([])).toEqual({ check: false, artifact: null, version: null, hash: null }));
  test('valid public artifact with exact version/raw SHA is accepted', () => fixture(file => expect(readArtifact(file, '1.10.3', hash)).toBe(text)));
  test('missing metadata, stale version/hash and missing source all reject', () => fixture(file => {
    expect(() => readArtifact(file)).toThrow(/requires/);
    expect(() => readArtifact(file, '1.10.2', hash)).toThrow(/stale/);
    expect(() => readArtifact(file, '1.10.3', 'a'.repeat(64))).toThrow(/stale/);
    expect(() => readArtifact(join(file, '..', 'missing', 'openapi.v1.public.yaml'), '1.10.3', hash)).toThrow();
  }));
  test('full SSOT and non-public contents reject before copying', () => fixture(file => {
    expect(() => readArtifact(file.replace('.public', ''), '1.10.3', hash)).toThrow(/named/);
    const privateText = text + 'x-internal: true\n'; writeFileSync(file, privateText);
    expect(() => readArtifact(file, '1.10.3', createHash('sha256').update(privateText).digest('hex'))).toThrow(/non-public/);
  }));
  test('invalid argument shapes cannot silently use remote source', () => {
    for (const args of [['--artifact'], ['--artifact-version', '1.10.3'], ['--unknown'], ['--artifact', 'a', '--artifact', 'b']]) expect(() => parseArgs(args)).toThrow();
  });
});
