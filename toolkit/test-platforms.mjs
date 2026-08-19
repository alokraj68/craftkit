// Cross-platform resolution, checked against the live release.
//
// Only one platform can be run here, so the rest are verified two ways: the
// mapping is asserted in code, and every asset it names is confirmed to exist
// in the published release. A target that resolves to a file nobody publishes
// is a broken install on a machine I cannot test.
import assert from 'node:assert/strict';
import { resolveTarget, detectMusl } from './install-lean-ctx.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};

console.log('\ntarget resolution');
const cases = [
  ['darwin', 'arm64', false, 'darwin-arm64'],
  ['darwin', 'x64', false, 'darwin-x64'],
  ['linux', 'x64', false, 'linux-x64'],
  ['linux', 'arm64', false, 'linux-arm64'],
  // Alpine reports plain linux-x64; a glibc binary fails there at load time.
  ['linux', 'x64', true, 'linux-x64-musl'],
  ['linux', 'arm64', true, 'linux-arm64-musl'],
  ['win32', 'x64', false, 'win32-x64'],
  // No arm64 Windows build is published; x64 runs under emulation.
  ['win32', 'arm64', false, 'win32-arm64'],
];
for (const [plat, cpu, musl, want] of cases) {
  test(`${plat}-${cpu}${musl ? ' musl' : ''} -> ${want}`,
    () => assert.equal(resolveTarget(plat, cpu, musl), want));
}

console.log('\nmusl detection');
test('never claims musl off linux', () => {
  assert.equal(detectMusl('darwin'), false);
  assert.equal(detectMusl('win32'), false);
});

console.log('\nevery target maps to a published asset');
const src = readFileSync(join(here, 'install-lean-ctx.mjs'), 'utf8');
const targets = Object.fromEntries(
  [...src.matchAll(/'([\w-]+)':\s*'(lean-ctx-)?([\w.-]+\.(?:tar\.gz|zip))'/g)].map((m) => [m[1], m[3]]),
);
const rel = await fetch('https://api.github.com/repos/yvgude/lean-ctx/releases/latest')
  .then((r) => (r.ok ? r.json() : null));
if (!rel) {
  console.log('  SKIPPED (no network or rate limited)');
} else {
  const names = new Set(rel.assets.map((a) => a.name));
  for (const [key, suffix] of Object.entries(targets)) {
    test(`${key} -> lean-ctx-${suffix} exists in ${rel.tag_name}`,
      () => assert.ok(names.has(`lean-ctx-${suffix}`), `missing lean-ctx-${suffix}`));
  }
}

console.log('\nno POSIX-only assumptions in the toolkit');
for (const f of ['onboard.mjs', 'install-lean-ctx.mjs', 'release.mjs']) {
  const body = readFileSync(join(here, f), 'utf8');
  test(`${f}: no hardcoded shell path`, () => {
    const hit = body.match(/shell:\s*'\/bin\/\w+'/);
    assert.ok(!hit, `hardcoded ${hit?.[0]} will fail on Windows`);
  });
  test(`${f}: no hardcoded /tmp`, () => {
    assert.ok(!/['"`]\/tmp\//.test(body), 'use tmpdir() so Windows gets a real temp path');
  });
}

console.log('\nregressions CI caught that a Mac never would');
const inst = readFileSync(join(here, 'install-lean-ctx.mjs'), 'utf8');

// On Windows process.argv[1] is D:\a\... while import.meta.url is a file://
// URL, so a string comparison never matches. The installer ran no code at all
// and exited 0, which reported success while installing nothing.
test('main-module guard uses pathToFileURL', () => {
  assert.ok(!/import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`/.test(inst),
    'string-compared file:// guard never matches on Windows');
  assert.ok(/pathToFileURL\(process\.argv\[1\]\)/.test(inst),
    'guard must build the URL rather than concatenate one');
});

// renameSync cannot cross a filesystem boundary. In a container /tmp and $HOME
// are usually separate mounts, which is EXDEV on Alpine.
test('handles EXDEV when moving the binary', () => {
  assert.ok(/EXDEV/.test(inst), 'no EXDEV fallback: rename fails across mounts');
  assert.ok(/copyFileSync/.test(inst), 'the fallback has to copy');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
