#!/usr/bin/env node
// craftkit onboarding.
//
//   npx craftkit                  interactive
//   npx craftkit ui coding        pick buckets up front
//   npx craftkit --all --yes      everything, no prompts
//   npx craftkit --list           show the catalogue, install nothing
//   npx craftkit --update-pins    resolve each upstream HEAD, write it back
//   npx craftkit ui --latest      ignore the pins on purpose
//   npx craftkit ui --dry-run     show exactly what would happen, do nothing
//   npx craftkit agents           write AGENTS.md for any non-Claude harness
//   npx craftkit agents --cursor  also write .cursor/rules/craftkit.mdc
//
// It does the work: enables plugins by writing settings.json, clones skills
// from their upstreams, and runs the installers that cannot be a plain copy.
// Nothing runs before you have seen the exact command and said yes.
import { execFileSync, execSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, cpSync, existsSync, mkdirSync,
  readFileSync, writeFileSync, readdirSync, copyFileSync,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const here = dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(readFileSync(join(here, 'catalogue.json'), 'utf8'));
const HOME = homedir();
const SKILLS_DIR = join(HOME, '.claude', 'skills');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const named = args.filter((a) => !a.startsWith('-'));
const autoYes = has('--yes') || has('-y');

const isTTY = process.stdin.isTTY && process.stdout.isTTY;
const C = process.stdout.isTTY
  ? { b: '\x1b[1m', dim: '\x1b[2m', g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', off: '\x1b[0m' }
  : { b: '', dim: '', g: '', y: '', r: '', c: '', off: '' };

const say = (s = '') => console.log(s);
const item = (id) => cat.items[id];

// ---------------------------------------------------------------- catalogue
function printCatalogue() {
  say(`\n${C.b}🧰 craftkit${C.off}\n`);
  say(`  ${C.dim}Always installed${C.off}`);
  for (const id of cat.always) say(`    ${id.padEnd(22)} ${C.dim}${item(id).what}${C.off}`);
  say('');
  for (const [key, b] of Object.entries(cat.buckets)) {
    say(`  ${b.emoji}  ${C.b}${b.label}${C.off}  ${C.dim}(${key})${C.off}`);
    say(`      ${C.dim}${b.blurb}${C.off}`);
    for (const id of b.items) say(`      ${id.padEnd(22)} ${C.dim}${item(id).what}${C.off}`);
    say('');
  }
}

// Not every harness is Claude Code. AGENTS.md is the convention Codex, Cursor,
// opencode and Copilot read, and the CLIs never needed a harness at all.
if (named[0] === 'agents') {
  const mod = await import(join(here, 'gen-agents.mjs'));
  if (has('--print')) { process.stdout.write(mod.renderAgentsMd()); process.exit(0); }
  const written = mod.writeAgents({ cursor: has('--cursor'), log: say });
  for (const w of written) say(`  wrote ${w.replace(process.cwd(), '.')}`);
  process.exit(written.length ? 0 : 1);
}

if (has('--list') || has('-l')) { printCatalogue(); process.exit(0); }

// Refresh every pin to its upstream HEAD and write the catalogue back, so
// moving to newer third-party code is a reviewable diff rather than something
// that happens quietly on the next install.
if (has('--update-pins')) {
  const file = join(here, 'catalogue.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  let changed = 0;
  say(`\n${C.b}  Resolving upstream HEADs${C.off}\n`);
  for (const [id, it] of Object.entries(raw.items)) {
    if (!it.repo || !it.commit) continue;
    try {
      const out = execFileSync('git', ['ls-remote', `https://github.com/${it.repo}.git`, 'HEAD'],
        { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
      const sha = out.split(/\s+/)[0];
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('no SHA in ls-remote output');
      if (sha === it.commit) {
        say(`    ${C.dim}=${C.off} ${id.padEnd(24)} ${C.dim}${sha.slice(0, 12)}${C.off}`);
      } else {
        say(`    ${C.y}~${C.off} ${id.padEnd(24)} ${it.commit.slice(0, 12)} ${C.y}->${C.off} ${sha.slice(0, 12)}`);
        // lean-ctx pins a raw.githubusercontent URL, which carries the SHA too.
        if (it.steps) it.steps = it.steps.map((x) => x.split(it.commit).join(sha));
        it.commit = sha;
        changed++;
      }
    } catch (err) {
      say(`    ${C.r}!${C.off} ${id.padEnd(24)} ${err.message.split('\n')[0]}`);
    }
  }
  if (changed) {
    writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
    say(`\n  ${C.g}${changed} pin(s) updated${C.off} in ${file.replace(HOME, '~')}`);
    say(`  ${C.dim}Review the diff before committing. These run with full agent permissions.${C.off}\n`);
  } else {
    say(`\n  ${C.dim}Every pin already matches upstream HEAD.${C.off}\n`);
  }
  process.exit(0);
}

// ------------------------------------------------------------------- choose
const keys = Object.keys(cat.buckets);
let chosen = named.filter((n) => keys.includes(n));
const unknown = named.filter((n) => !keys.includes(n) && n !== 'agents');
if (unknown.length) {
  console.error(`craftkit: unknown option(s): ${unknown.join(', ')}\nKnown: ${keys.join(', ')}`);
  process.exit(2);
}

if (has('--all')) chosen = keys;

if (!chosen.length) {
  if (!isTTY) {
    console.error('craftkit: no terminal to ask in. Pass buckets, e.g. `craftkit ui coding`, or --all --yes.');
    process.exit(2);
  }
  say(`\n${C.b}🧰 craftkit${C.off}`);
  say(`\n  What will you be doing on this machine?`);
  say(`  ${C.dim}Pick any number of them.${C.off}\n`);
  keys.forEach((k, i) => {
    const b = cat.buckets[k];
    say(`    ${C.b}${i + 1}${C.off}  ${b.emoji}  ${b.label}`);
    say(`       ${C.dim}${b.blurb}${C.off}`);
  });
  say(`\n  ${C.dim}Whatever you pick, ${cat.always.join(' and ')} are installed too.${C.off}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n  ${C.c}Numbers (e.g. 1,3), "all", or blank to cancel:${C.off} `);
  rl.close();
  const raw = answer.trim().toLowerCase();
  if (!raw) { say('\n  Nothing installed.\n'); process.exit(0); }
  if (raw === 'all') chosen = keys;
  else {
    const picked = new Set();
    for (const part of raw.split(/[,\s]+/).filter(Boolean)) {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) for (let i = +range[1]; i <= +range[2]; i++) picked.add(i);
      else if (/^\d+$/.test(part)) picked.add(+part);
      else say(`  ${C.y}ignoring "${part}"${C.off}`);
    }
    chosen = [...picked].map((n) => keys[n - 1]).filter(Boolean);
  }
  if (!chosen.length) { say('\n  Nothing selected.\n'); process.exit(0); }
}

// ------------------------------------------------------------------ the plan
const wanted = [...new Set([...cat.always, ...chosen.flatMap((k) => cat.buckets[k].items)])];
const plugins = wanted.filter((id) => ['plugin', 'craftkit'].includes(item(id).kind));
const skills = wanted.filter((id) => item(id).kind === 'skill');
const manual = wanted.filter((id) => ['manual', 'installer'].includes(item(id).kind));

const scope = has('--project') ? 'project' : 'user';
const settingsPath = scope === 'project'
  ? join(process.cwd(), '.claude', 'settings.json')
  : join(HOME, '.claude', 'settings.json');

say(`\n${C.b}  Plan${C.off}  ${C.dim}(${chosen.join(', ')})${C.off}\n`);

if (plugins.length) {
  say(`  ${C.b}Plugins${C.off} ${C.dim}enabled in ${settingsPath.replace(HOME, '~')}${C.off}`);
  for (const id of plugins) {
    const it = item(id);
    const src = it.kind === 'craftkit' ? 'alokraj68/craftkit' : it.repo;
    say(`    ${id.padEnd(22)} ${C.dim}${src}${C.off}`);
  }
  say('');
}
if (skills.length) {
  say(`  ${C.b}Skills${C.off} ${C.dim}cloned into ~/.claude/skills${C.off}`);
  for (const id of skills) {
    const it = item(id);
    const n = it.take?.length > 1 ? ` (${it.take.length} skills)` : '';
    const at = has('--latest') ? `${C.y}latest${C.off}` : `${C.dim}@${(it.commit ?? '?').slice(0, 8)}${C.off}`;
    say(`    ${(id + n).padEnd(22)} ${C.dim}${it.repo}${C.off} ${at} ${C.dim}[${it.licence}]${C.off}`);
  }
  say('');
}
if (manual.length) {
  say(`  ${C.b}Installers${C.off} ${C.dim}these run commands on your machine${C.off}`);
  for (const id of manual) {
    const it = item(id);
    say(`    ${C.b}${id}${C.off}  ${C.dim}${it.repo}${C.off}`);
    if (it.why_manual) say(`      ${C.dim}${it.why_manual}${C.off}`);
    for (const s of it.steps) say(`      ${C.y}$ ${s}${C.off}`);
  }
  say('');
}

say(`  ${C.dim}Third-party skills are cloned from their own repositories, never copied`);
say(`  into craftkit, and pinned to the commit shown. They run with full agent`);
say(`  permissions once installed.${C.off}`);
if (has('--latest')) {
  say(`\n  ${C.y}--latest: pins ignored. You will get whatever is on the default branch${C.off}`);
  say(`  ${C.y}right now, which nobody has reviewed.${C.off}`);
}

if (has('--dry-run')) {
  say(`\n  ${C.dim}--dry-run: nothing was installed.${C.off}\n`);
  process.exit(0);
}

if (!autoYes) {
  if (!isTTY) { console.error('\ncraftkit: pass --yes to run without a prompt.'); process.exit(2); }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = await rl.question(`\n  ${C.c}Install all of this? [y/N]${C.off} `);
  rl.close();
  if (!/^y(es)?$/i.test(ok.trim())) { say('\n  Nothing installed.\n'); process.exit(0); }
}

// ------------------------------------------------------------------- plugins
const done = [];
const failed = [];

if (plugins.length) {
  say(`\n${C.b}  Plugins${C.off}`);
  mkdirSync(dirname(settingsPath), { recursive: true });
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      // Never edit someone's config without a way back.
      const backup = `${settingsPath}.craftkit-backup`;
      copyFileSync(settingsPath, backup);
      say(`    ${C.dim}backed up to ${backup.replace(HOME, '~')}${C.off}`);
    } catch (err) {
      console.error(`    ${C.r}${settingsPath} is not valid JSON (${err.message}). Left untouched.${C.off}`);
      settings = null;
    }
  }
  if (settings) {
    settings.extraKnownMarketplaces ??= {};
    settings.enabledPlugins ??= {};
    for (const id of plugins) {
      const it = item(id);
      const market = it.kind === 'craftkit' ? 'craftkit' : it.marketplace;
      const repo = it.kind === 'craftkit' ? 'alokraj68/craftkit' : it.repo;
      settings.extraKnownMarketplaces[market] = { source: { source: 'github', repo } };
      settings.enabledPlugins[`${it.plugin}@${market}`] = true;
      say(`    ${C.g}+${C.off} ${it.plugin}@${market}`);
      done.push(`${it.plugin}@${market}`);
    }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    say(`    ${C.dim}wrote ${settingsPath.replace(HOME, '~')}${C.off}`);
  } else {
    failed.push('plugins (settings.json unreadable)');
  }
}

// -------------------------------------------------------------------- skills
if (skills.length) {
  say(`\n${C.b}  Skills${C.off}`);
  mkdirSync(SKILLS_DIR, { recursive: true });
  for (const id of skills) {
    const it = item(id);
    const tmp = mkdtempSync(join(tmpdir(), 'craftkit-'));
    const pin = has('--latest') ? null : it.commit;
    try {
      process.stdout.write(`    ${id} ${C.dim}fetching ${it.repo}${pin ? `@${pin.slice(0, 8)}` : ' (latest)'}…${C.off}`);
      const url = `https://github.com/${it.repo}.git`;
      if (pin) {
        // Fetch the one commit rather than cloning history. GitHub serves a
        // SHA directly; if a host refuses, fall back to a full clone.
        execFileSync('git', ['init', '--quiet', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
        execFileSync('git', ['-C', tmp, 'remote', 'add', 'origin', url], { stdio: ['ignore', 'pipe', 'pipe'] });
        try {
          execFileSync('git', ['-C', tmp, 'fetch', '--depth', '1', '--quiet', 'origin', pin],
            { stdio: ['ignore', 'pipe', 'pipe'] });
          execFileSync('git', ['-C', tmp, 'checkout', '--quiet', 'FETCH_HEAD'], { stdio: ['ignore', 'pipe', 'pipe'] });
        } catch {
          rmSync(tmp, { recursive: true, force: true });
          mkdirSync(tmp, { recursive: true });
          execFileSync('git', ['clone', '--quiet', url, tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
          execFileSync('git', ['-C', tmp, 'checkout', '--quiet', pin], { stdio: ['ignore', 'pipe', 'pipe'] });
        }
        // Prove we are on the commit the catalogue names, not whatever arrived.
        const at = execFileSync('git', ['-C', tmp, 'rev-parse', 'HEAD'],
          { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
        if (at !== pin) throw new Error(`expected ${pin}, got ${at}`);
      } else {
        execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
      }
      say('');
      for (const sub of it.take) {
        const from = join(tmp, sub);
        if (!existsSync(from)) { say(`      ${C.y}missing upstream: ${sub}${C.off}`); continue; }
        const isSkill = existsSync(join(from, 'SKILL.md'));
        const dirs = isSkill ? [from] : readdirSync(from, { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(join(from, d.name, 'SKILL.md')))
          .map((d) => join(from, d.name));
        for (const dir of dirs) {
          // Install under the skill's declared name: a directory whose name
          // differs from `name:` in the frontmatter will not resolve cleanly.
          const head = readFileSync(join(dir, 'SKILL.md'), 'utf8').slice(0, 800);
          const declared = head.match(/^name:\s*(.+)$/m)?.[1]?.trim() || basename(dir);
          cpSync(dir, join(SKILLS_DIR, declared), { recursive: true });
          say(`      ${C.g}+${C.off} ${declared}`);
          done.push(declared);
        }
      }
    } catch (err) {
      say(` ${C.r}failed${C.off}`);
      say(`      ${err.message.split('\n')[0]}`);
      failed.push(`${id} (${it.repo})`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------- installers
if (manual.length) {
  say(`\n${C.b}  Installers${C.off}`);
  for (const id of manual) {
    const it = item(id);
    // Some tools ship a binary rather than an npm package. craftkit carries a
    // Node installer for those, so nothing has to pipe a remote script into a
    // shell that may not exist on this machine.
    if (it.runner) {
      say(`    ${C.b}${id}${C.off}`);
      try {
        const mod = await import(join(here, it.runner));
        await mod.installLeanCtx({ log: say });
        done.push(id);
      } catch (err) {
        say(`      ${C.r}failed: ${err.message}${C.off}`);
        failed.push(`${id}: ${err.message}`);
        continue; // the follow-up steps need the binary
      }
    }
    for (const step of it.steps) {
      // A hardcoded /bin/bash does not exist on Windows, where every installer
      // failed on a real run. Let the platform pick its own shell.
      const isWindows = process.platform === 'win32';
      if (isWindows && /\|\s*bash|curl -fsSL/.test(step)) {
        say(`    ${C.y}$ ${step}${C.off}`);
        say(`      ${C.y}skipped: this needs a POSIX shell. Run it in WSL or Git Bash.${C.off}`);
        skipped.push(`${id}: needs bash, run it yourself`);
        continue;
      }
      say(`    ${C.y}$ ${step}${C.off}`);
      try {
        execSync(step, { stdio: ['ignore', 'inherit', 'inherit'], shell: true });
        done.push(`${id}: ${step.split(' ')[0]}`);
      } catch (err) {
        const code = err.status ?? err.code ?? 'unknown';
        say(`      ${C.r}failed (exit ${code})${C.off}`);
        failed.push(`${id}: ${step} -> exit ${code}`);
        break; // later steps in a chain depend on the earlier ones
      }
    }
  }
}

// -------------------------------------------------------------------- report
say(`\n${C.b}  Done${C.off}`);
say(`    ${C.g}${done.length} installed${C.off}${failed.length ? `, ${C.r}${failed.length} failed${C.off}` : ''}`);
if (failed.length) {
  for (const f of failed) say(`      ${C.r}·${C.off} ${f}`);
  say(`\n    ${C.dim}Everything else went in. Re-run craftkit to retry just these.${C.off}`);
}
if (plugins.length) {
  say(`\n    ${C.dim}Restart Claude Code so it picks up the plugin changes.${C.off}`);
}
say(`\n    ${C.dim}Read a SKILL.md before relying on it. A skill is advice, not authority.${C.off}\n`);

process.exit(failed.length ? 1 : 0);
