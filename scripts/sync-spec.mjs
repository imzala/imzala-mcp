#!/usr/bin/env node
// Keeps this package's copy of the public OpenAPI document in step with the
// backend, and pins its version and hash in api-coverage.json.
//
//   node scripts/sync-spec.mjs          copy + re-pin
//   node scripts/sync-spec.mjs --check  exit 1 when the copy is behind
//
// The source is ALWAYS the published derivative (openapi.v1.public.yaml). The
// full specification carries internal-only operations and must never be copied
// into this public repository, so the path is fixed here and not configurable.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

const check = process.argv.includes('--check');
const repo = findBackendRepo();
if (!repo) {
  console.log('spec: backend repository not found next to this package; skipped (set IMZALA_BACKEND_REPO to enable).');
  process.exit(0);
}

const upstream = readUpstream(repo);
const upstreamSha = sha256(upstream);
const coverage = JSON.parse(readFileSync(COVERAGE, 'utf8'));
const { version, ops } = operationsOf(upstream);

if (check) {
  if (coverage.specSha256 === upstreamSha) {
    console.log(`spec: OK, pinned to API ${coverage.specVersion}.`);
    process.exit(0);
  }
  console.error(`spec: BEHIND. Pinned API ${coverage.specVersion}, backend ${SOURCE_REF} is ${version}.`);
  console.error('Run "npm run spec:sync", classify any new operation in api-coverage.json and update the affected tools.');
  process.exit(1);
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
