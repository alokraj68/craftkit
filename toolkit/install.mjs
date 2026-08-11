#!/usr/bin/env node
// Pick what you need. Nothing installs without you choosing it.
//
//   node toolkit/install.mjs            interactive picker
//   node toolkit/install.mjs --list     show everything, install nothing
//   node toolkit/install.mjs animate karpathy-guidelines
//   node toolkit/install.mjs --all --yes
//
// Third-party skills are cloned from their own repositories, never vendored
// here. Most carry no licence, which under copyright means the author kept
// every right - so shipping a copy would be infringement even though the code
// is public. Cloning also means their fixes reach you instead of a snapshot.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'skills.json'), 'utf8'));
const DEST = join(homedir(), '.claude', 'skills');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const named = args.filter((a) => !a.startsWith('-'));

/** Every installable skill, flattened - a repo may carry several. */
const catalogue = manifest.skills.flatMap((s) =>
  (s.take ?? [null]).map((sub) => ({
    id: s.label && (s.take ?? []).length === 1 ? s.label : (sub ? basename(sub) : s.name),
    group: s.name,
    repo: s.repo,
    sub,
    installer: s.installer ?? null,
    note: s.note,
    licence: s.licence,
  })),
);

function printCatalogue() {
  console.log('\n  Claude Code marketplaces - add these from inside Claude Code:\n');
  for (const m of manifest.marketplaces) console.log(`    ${m.install}\n        ${m.use}\n`);
  console.log('  Skills this script can install:\n');
  catalogue.forEach((c, i) => {
    console.log(`    ${String(i + 1).padStart(2)}. ${c.id.padEnd(30)} ${c.repo}  [${c.licence}]`);
  });
  console.log('\n  Installed separately:\n');
  for (const c of manifest.cli) console.log(`    ${c.name.padEnd(30)} ${c.repo}`);
  console.log('');
}

if (has('--list') || has('-l')) { printCatalogue(); process.exit(0); }

let chosen;
if (named.length) {
  chosen = catalogue.filter((c) => named.includes(c.id) || named.includes(c.group));
  if (!chosen.length) {
    console.error(`No match for: ${named.join(', ')}\nRun with --list to see what is available.`);
    process.exit(2);
  }
} else if (has('--all')) {
  chosen = catalogue;
} else {
  printCatalogue();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('  Numbers to install (e.g. 1,3,5-7), "all", or blank to cancel: ');
  rl.close();
  const raw = answer.trim().toLowerCase();
  if (!raw) { console.log('  Nothing installed.\n'); process.exit(0); }
  if (raw === 'all') chosen = catalogue;
  else {
    const picked = new Set();
    for (const part of raw.split(/[,\s]+/).filter(Boolean)) {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        for (let i = +range[1]; i <= +range[2]; i++) picked.add(i);
      } else if (/^\d+$/.test(part)) picked.add(+part);
      else console.log(`  ignoring "${part}"`);
    }
    chosen = [...picked].map((n) => catalogue[n - 1]).filter(Boolean);
  }
  if (!chosen.length) { console.log('  Nothing selected.\n'); process.exit(0); }
}

console.log(`\n  Installing into ${DEST}\n`);
for (const c of chosen) console.log(`    ${c.id}  <-  github.com/${c.repo}  [${c.licence}]`);

if (!has('--yes') && !has('-y')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = await rl.question('\n  These run with full agent permissions. Continue? [y/N] ');
  rl.close();
  if (!/^y(es)?$/i.test(ok.trim())) { console.log('  Nothing installed.\n'); process.exit(0); }
}

mkdirSync(DEST, { recursive: true });
const clones = new Map();
let installed = 0;
const skipped = [];

try {
  for (const c of chosen) {
    if (c.installer) {
      console.log(`\n  ${c.id}: run this yourself - ${c.installer}`);
      if (c.note) console.log(`      ${c.note}`);
      skipped.push(`${c.id} (use: ${c.installer})`);
      continue;
    }
    // One clone per repo, even when several skills come from it.
    if (!clones.has(c.repo)) {
      const tmp = mkdtempSync(join(tmpdir(), 'craftkit-'));
      process.stdout.write(`\n  cloning ${c.repo}… `);
      try {
        execFileSync('git', ['clone', '--depth', '1', '--quiet', `https://github.com/${c.repo}.git`, tmp],
          { stdio: ['ignore', 'pipe', 'pipe'] });
        clones.set(c.repo, tmp);
        process.stdout.write('ok');
      } catch (err) {
        process.stdout.write('failed');
        skipped.push(`${c.repo} (${err.message.split('\n')[0]})`);
        clones.set(c.repo, null);
      }
    }
    const root = clones.get(c.repo);
    if (!root) continue;

    const from = c.sub ? join(root, c.sub) : root;
    if (!existsSync(from)) { console.log(`\n    missing upstream: ${c.sub}`); continue; }

    const isSkill = existsSync(join(from, 'SKILL.md'));
    const dirs = isSkill
      ? [from]
      : readdirSync(from, { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(join(from, d.name, 'SKILL.md')))
          .map((d) => join(from, d.name));

    for (const dir of dirs) {
      // Install under the skill's declared name: a directory whose name differs
      // from `name:` in the frontmatter will not resolve cleanly.
      const head = readFileSync(join(dir, 'SKILL.md'), 'utf8').slice(0, 800);
      const declared = head.match(/^name:\s*(.+)$/m)?.[1]?.trim();
      cpSync(dir, join(DEST, declared || basename(dir)), { recursive: true });
      installed++;
      console.log(`\n    installed ${declared || basename(dir)}`);
    }
  }
} finally {
  for (const tmp of clones.values()) if (tmp) rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n  ${installed} skill(s) installed into ${DEST}`);
if (skipped.length) console.log(`  skipped:\n    ${skipped.join('\n    ')}`);
console.log('\n  Read each SKILL.md before relying on it. A skill is advice, not authority.\n');
