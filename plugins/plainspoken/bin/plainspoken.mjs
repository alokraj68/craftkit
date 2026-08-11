#!/usr/bin/env node
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lint } from '../src/lint.mjs';

const EXTS = new Set(['.md', '.mdx', '.markdown', '.txt']);
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
  console.log(`plainspoken - fail the build when writing reads as machine-written

  plainspoken [paths...]        lint files or directories (default: .)
  cat file.md | plainspoken -   lint stdin

  --warnings-as-errors   exit non-zero on warnings too
  --quiet                findings only, no summary
  --json                 machine-readable output
  --config <path>        config file (default: plainspoken.config.json)
  --preset <name>        docs (default) | resume | strict

Suppress inline with <!-- plainspoken-disable-next-line -->, or a
<!-- plainspoken-disable --> / <!-- plainspoken-enable --> block.

Config keys: maxEmDashesPerDoc, maxPassiveRatio, maxAbstractRatio,
maxFillerAdjectiveSentences, warnOnAiWords, allow (array of permitted words).`);
  process.exit(0);
}

const flag = (n) => args.includes(n);
const valueOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const asJson = flag('--json');
const quiet = flag('--quiet');
const strict = flag('--warnings-as-errors');

// ---- config ---------------------------------------------------------------
let config = {};
const configPath = valueOf('--config') ?? ['plainspoken.config.json', '.plainspokenrc.json']
  .find((f) => existsSync(f));
if (configPath && existsSync(configPath)) {
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`plainspoken: cannot read ${configPath}: ${err.message}`);
    process.exit(2);
  }
}

// ---- inputs ---------------------------------------------------------------
const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor']);
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (IGNORE.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (EXTS.has(extname(entry.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

const preset = valueOf('--preset');
if (preset) config.preset = preset;
const consumed = new Set([valueOf('--config'), valueOf('--preset')].filter(Boolean));
const paths = args.filter((a) => !a.startsWith('-') && !consumed.has(a));
let docs = [];

if (args.includes('-')) {
  const stdin = readFileSync(0, 'utf8');
  docs.push({ file: '<stdin>', text: stdin });
} else {
  const targets = paths.length ? paths : ['.'];
  for (const t of targets) {
    if (!existsSync(t)) {
      console.error(`plainspoken: no such path: ${t}`);
      process.exit(2);
    }
    if (statSync(t).isDirectory()) {
      for (const f of walk(t)) docs.push({ file: f, text: readFileSync(f, 'utf8') });
    } else {
      docs.push({ file: t, text: readFileSync(t, 'utf8') });
    }
  }
}

if (!docs.length) {
  console.error('plainspoken: no .md, .mdx or .txt files found');
  process.exit(2);
}

// ---- run ------------------------------------------------------------------
const results = docs.map(({ file, text }) => ({ file, ...lint(text, config) }));
const errors = results.reduce((n, r) => n + r.stats.errors, 0);
const warnings = results.reduce((n, r) => n + r.stats.warnings, 0);

if (asJson) {
  console.log(JSON.stringify({ results, errors, warnings }, null, 2));
} else {
  const C = process.stdout.isTTY
    ? { red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', green: '\x1b[32m', off: '\x1b[0m' }
    : { red: '', yellow: '', dim: '', green: '', off: '' };

  for (const r of results) {
    if (!r.findings.length) {
      if (!quiet) console.log(`${C.green}ok${C.off}   ${r.file}`);
      continue;
    }
    console.log(`\n${r.file}`);
    for (const f of r.findings) {
      const tag = f.severity === 'error' ? `${C.red}error${C.off}` : `${C.yellow}warn ${C.off}`;
      console.log(`  ${tag} ${String(f.line).padStart(4)}  ${f.rule.padEnd(16)} ${f.message}`);
      if (f.evidence) {
        const snip = f.evidence.replace(/\s+/g, ' ').slice(0, 96);
        console.log(`        ${C.dim}${snip}${f.evidence.length > 96 ? '…' : ''}${C.off}`);
      }
    }
  }
  if (!quiet) {
    console.log(`\n${docs.length} file(s): ${errors} error(s), ${warnings} warning(s)`);
  }
}

process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
