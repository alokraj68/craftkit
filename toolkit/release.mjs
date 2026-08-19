#!/usr/bin/env node
// One place to release every package in this repo.
//
//   npm run release -- --dry-run          what would go out, and why
//   npm run release                       publish whatever is not on npm yet
//   npm run release -- --otp 123456       pass the 2FA code once for all of them
//   npm run release -- --bump patch       bump all versions in step, then publish
//   npm run release -- --bump 2.0.0       set an exact version
//
// Versions move together on purpose. Four packages that only make sense as a
// set, drifting to 1.4.2 / 1.0.9 / 1.2.0, is a support question nobody wants to
// answer. One number describes the whole repo.
//
// Once trusted publishers are configured on npmjs.com this is the fallback, not
// the path: .github/workflows/publish.yml does the same thing on push, with
// provenance, and needs no 2FA code at all.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = ['.', 'plugins/plainspoken', 'plugins/pagecheck', 'plugins/ats-resume'];
// Plugin manifests carry a version too. A marketplace entry that disagrees with
// the package it points at is a bug report waiting to happen.
const MANIFESTS = [
  'plugins/plainspoken/.claude-plugin/plugin.json',
  'plugins/pagecheck/.claude-plugin/plugin.json',
  'plugins/ats-resume/.claude-plugin/plugin.json',
  'plugins/craft-setup/.claude-plugin/plugin.json',
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => { const i = args.indexOf(f); return i === -1 ? null : args[i + 1]; };
const dryRun = has('--dry-run');

const C = process.stdout.isTTY
  ? { b: '\x1b[1m', dim: '\x1b[2m', g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', off: '\x1b[0m' }
  : { b: '', dim: '', g: '', y: '', r: '', c: '', off: '' };
const say = (s = '') => console.log(s);

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const writeJson = (p, d) => writeFileSync(join(root, p), JSON.stringify(d, null, 2) + '\n');

if (has('-h') || has('--help')) {
  say(readFileSync(fileURLToPath(import.meta.url), 'utf8')
    .split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------- bump first
const bump = valueOf('--bump');
if (bump) {
  const current = readJson('package.json').version;
  let next = bump;
  if (['patch', 'minor', 'major'].includes(bump)) {
    const [maj, min, pat] = current.split('.').map(Number);
    next = bump === 'major' ? `${maj + 1}.0.0` : bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
  }
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(next)) {
    console.error(`release: "${bump}" is not a version or patch|minor|major`);
    process.exit(2);
  }
  say(`\n${C.b}  Version${C.off}  ${current} ${C.y}->${C.off} ${next}\n`);
  for (const p of [...PKGS.map((d) => join(d, 'package.json')), ...MANIFESTS]) {
    if (!existsSync(join(root, p))) continue;
    const d = readJson(p);
    d.version = next;
    if (!dryRun) writeJson(p, d);
    say(`    ${p}`);
  }
  if (dryRun) say(`\n  ${C.dim}--dry-run: nothing written.${C.off}`);
}

// ------------------------------------------------------------- what is needed
say(`\n${C.b}  Packages${C.off}\n`);
const plan = [];
for (const dir of PKGS) {
  const pkg = readJson(join(dir, 'package.json'));
  let published = false;
  try {
    execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    published = true;
  } catch { /* not on the registry: that is the normal case here */ }
  const label = `${pkg.name}@${pkg.version}`;
  if (published) say(`    ${C.dim}=${C.off} ${label.padEnd(34)} ${C.dim}already on npm${C.off}`);
  else { say(`    ${C.g}+${C.off} ${label.padEnd(34)} ${C.c}will publish${C.off}`); plan.push({ dir, ...pkg }); }
}

if (!plan.length) {
  say(`\n  ${C.dim}Every version is already published. Bump with --bump patch.${C.off}\n`);
  process.exit(0);
}

if (dryRun) { say(`\n  ${C.dim}--dry-run: nothing published.${C.off}\n`); process.exit(0); }

// -------------------------------------------------------------------- verify
// Publishing something whose tests were never run is the one mistake that
// cannot be taken back: npm restricts unpublishing after 72 hours.
say(`\n${C.b}  Tests${C.off}`);
for (const t of ['plainspoken', 'ats-resume', 'pagecheck']) {
  try {
    const out = execFileSync('node', [`plugins/${t}/test/run.mjs`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString().trim().split('\n').pop();
    say(`    ${C.g}ok${C.off}   ${t.padEnd(14)} ${C.dim}${out}${C.off}`);
  } catch (err) {
    say(`    ${C.r}FAIL${C.off} ${t}`);
    say((err.stdout?.toString() ?? '').split('\n').slice(-12).join('\n'));
    say(`\n  ${C.r}Not publishing. Fix the tests first.${C.off}\n`);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------- otp
let otp = valueOf('--otp');
if (!otp && process.stdin.isTTY) {
  say(`\n  ${C.dim}This account requires 2FA on writes. One code covers all${C.off}`);
  say(`  ${C.dim}${plan.length} packages if they publish inside its window.${C.off}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  otp = (await rl.question(`\n  ${C.c}Authenticator code (blank to let npm ask):${C.off} `)).trim();
  rl.close();
}

// ------------------------------------------------------------------- publish
say(`\n${C.b}  Publishing${C.off}`);
const done = [], failed = [];
for (const p of plan) {
  process.stdout.write(`    ${p.name}@${p.version} … `);
  const cmd = ['publish', '--access', 'public', ...(otp ? ['--otp', otp] : [])];
  try {
    execFileSync('npm', cmd, { cwd: join(root, p.dir), stdio: ['inherit', 'pipe', 'pipe'] });
    say(`${C.g}published${C.off}`);
    done.push(`${p.name}@${p.version}`);
  } catch (err) {
    const msg = (err.stderr?.toString() ?? err.message).split('\n')
      .find((l) => /npm error/.test(l) && !/^npm error$/.test(l)) ?? err.message;
    say(`${C.r}failed${C.off}`);
    say(`      ${C.r}${msg.replace('npm error ', '').slice(0, 140)}${C.off}`);
    failed.push(p.name);
    // A wrong or expired OTP will fail every remaining package the same way.
    if (/one-time pass|otp|EOTP|401/i.test(msg)) {
      say(`      ${C.y}The code was rejected. Re-run with a fresh one.${C.off}`);
      break;
    }
  }
}

say(`\n${C.b}  Done${C.off}`);
for (const d of done) say(`    ${C.g}+${C.off} ${d}`);
for (const f of failed) say(`    ${C.r}-${C.off} ${f}`);
if (done.length && !failed.length) {
  say(`\n    ${C.dim}Next: tag it, and add a trusted publisher on npmjs.com for each${C.off}`);
  say(`    ${C.dim}package (alokraj68 / craftkit / publish.yml) so future releases${C.off}`);
  say(`    ${C.dim}run from CI with provenance and no 2FA code.${C.off}`);
}
say('');
process.exit(failed.length ? 1 : 0);
