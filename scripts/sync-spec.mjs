#!/usr/bin/env node
// Keeps this package's copy of the public OpenAPI document in step with the
// backend, and pins its version and hash in api-coverage.json.
//
//   node scripts/sync-spec.mjs          copy + re-pin
//   node scripts/sync-spec.mjs --check  exit 1 when the copy is behind
//
// The source is ALWAYS the published derivative (openapi.v1.public.yaml). The
// full specification carries internal-only operations and must never be copied.
// Offline preparation may use --artifact <openapi.v1.public.yaml> only with
// --artifact-version <version> --artifact-sha256 <raw-file SHA-256>.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = 'openapi/openapi.v1.public.yaml';
const SOURCE_REF = 'origin/main';
const COPY = join(ROOT, 'spec', 'openapi.v1.public.yaml');
const COVERAGE = join(ROOT, 'api-coverage.json');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function findBackendRepo() {
  const candidates = [
    process.env.IMZALA_BACKEND_REPO,
    join(ROOT, '..', 'imzala'),
    join(ROOT, '..', '..', '..', 'imzala'), // from a .worktrees/<slug> checkout
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(join(dir, '.git')));
}

function readUpstream(repo) {
  return execFileSync('git', ['-C', repo, 'show', `${SOURCE_REF}:${SOURCE_PATH}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function operationsOf(specText) {
  const doc = parse(specText);
  const ops = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) if (item[method]) ops.push(`${method.toUpperCase()} ${path}`);
  }
  return { version: String(doc.info.version), ops };
}

/** Explicit offline source: expected version and raw-file SHA are mandatory. */
export function readArtifact(file, expectedVersion, expectedSha) {
  if (!file || basename(file) !== 'openapi.v1.public.yaml') throw new Error('Artifact must be named openapi.v1.public.yaml.');
  if (!/^\d+\.\d+\.\d+$/.test(expectedVersion ?? '') || !/^[0-9a-f]{64}$/.test(expectedSha ?? '')) {
    throw new Error('Artifact requires --artifact-version and --artifact-sha256.');
  }
  const text = readFileSync(resolve(file), 'utf8');
  const doc = parse(text);
  if (!doc?.info || !doc.paths || !/^3\./.test(String(doc.openapi))) throw new Error('Invalid public artifact.');
  for (const marker of ['x-internal', 'x-imzala-', 'svc.cluster.local', '.imzala.internal', 'BEGIN PRIVATE KEY']) {
    if (text.includes(marker)) throw new Error('Artifact contains non-public content.');
  }
  if (String(doc.info.version) !== expectedVersion || sha256(text) !== expectedSha) throw new Error('Artifact version/hash is stale or mismatched.');
  return text;
}

export function parseArgs(argv) {
  const out = { check: false, artifact: null, version: null, hash: null };
  const fields = { '--artifact': 'artifact', '--artifact-version': 'version', '--artifact-sha256': 'hash' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') { out.check = true; continue; }
    const field = fields[argv[i]];
    if (!field || !argv[i + 1] || argv[i + 1].startsWith('--') || out[field] !== null) throw new Error('Invalid spec sync arguments.');
    out[field] = argv[++i];
  }
  if (!out.artifact && (out.version || out.hash)) throw new Error('Artifact metadata requires --artifact.');
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repo = args.artifact ? null : findBackendRepo();
  if (!args.artifact && !repo) {
    console.log('spec: backend repository not found next to this package; skipped (set IMZALA_BACKEND_REPO to enable).');
    return 0;
  }
  const upstream = args.artifact ? readArtifact(args.artifact, args.version, args.hash) : readUpstream(repo);
  const upstreamSha = sha256(upstream);
  const coverage = JSON.parse(readFileSync(COVERAGE, 'utf8'));
  const { version, ops } = operationsOf(upstream);
  if (args.check) {
    if (coverage.specSha256 === upstreamSha && coverage.specVersion === version && readFileSync(COPY, 'utf8') === upstream) {
      console.log(`spec: OK, pinned to API ${coverage.specVersion}.`);
      return 0;
    }
    console.error(`spec: BEHIND. Pinned API ${coverage.specVersion}, ${args.artifact ? 'local artifact' : SOURCE_REF} is ${version}.`);
    console.error('Run "npm run spec:sync", classify any new operation in api-coverage.json and update the affected tools.');
    return 1;
  }
  writeFileSync(COPY, upstream);
  coverage.specVersion = version;
  coverage.specSha256 = upstreamSha;
  writeFileSync(COVERAGE, `${JSON.stringify(coverage, null, 2)}\n`);
  const unclassified = ops.filter((op) => !(op in coverage.operations));
  console.log(`spec: copied API ${version} (${ops.length} operations).`);
  if (unclassified.length) {
    console.log('Not classified yet in api-coverage.json:');
    for (const op of unclassified) console.log(`  ${op}`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(`spec: FAILED: ${error.message}`); process.exitCode = 1; }
}
