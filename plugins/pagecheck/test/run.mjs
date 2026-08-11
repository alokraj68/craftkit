// A checker that has only ever passed is not a checker.
//
// fixtures/broken/ is built to trip every rule, and fixtures/clean/ is built to
// trip none. Both halves are asserted, because the failure mode that matters
// here is not a miss - it is a false positive. A noisy layout audit gets
// switched off, and then it catches nothing at all.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { layoutAudit, typeAudit, typeIssues, DEFAULTS } from '../src/audit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};

// ---- pure rules, no browser needed ----------------------------------------
console.log('\ntypography rules');
const base = { size: 16, weight: '400', leading: 1.6, contrast: 8, cpl: 65, count: 3, isDisplay: false };
const only = (row, vp = 'desktop') => typeIssues({ ...base, ...row }, vp, DEFAULTS);

test('flags body text under 14px', () => assert.ok(only({ size: 12 }).some((i) => /too small/.test(i))));
test('does not flag a 30px heading', () => assert.equal(only({ size: 30, isDisplay: true }).length, 0));
test('flags tight leading', () => assert.ok(only({ leading: 1.2 }).some((i) => /tight/.test(i))));
test('flags thin weight at small size', () => assert.ok(only({ size: 16, weight: '300' }).some((i) => /thin/.test(i))));
test('flags body contrast under 4.5:1', () => assert.ok(only({ contrast: 3.9 }).some((i) => /below AA/.test(i))));
test('allows 3:1 for display type', () => assert.ok(!only({ size: 30, isDisplay: true, contrast: 3.4 }).some((i) => /below AA/.test(i))));
test('flags an over-wide measure', () => assert.ok(only({ cpl: 110 }).some((i) => /too wide/.test(i))));
test('flags a narrow measure on desktop', () => assert.ok(only({ cpl: 30 }).some((i) => /narrow/.test(i))));
// At 390px a readable 16px face physically cannot reach 45 characters, so
// reporting narrow measure on a phone is noise, not a finding.
test('does NOT flag narrow measure on mobile', () =>
  assert.ok(!only({ cpl: 30 }, 'iPhone 14').some((i) => /narrow/.test(i))));
test('clean row yields nothing', () => assert.equal(only({}).length, 0));

// ---- the real audits, in a real browser ------------------------------------
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { /* optional */ }

if (!chromium) {
  console.log('\nbrowser audits: SKIPPED (playwright not installed)');
} else {
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  const serve = async (dir) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(dir, p);
      if (!existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
      res.end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, r));
    return { url: `http://localhost:${server.address().port}/`, close: () => server.close() };
  };

  const browser = await chromium.launch();
  const run = async (fixture, width) => {
    const s = await serve(join(here, 'fixtures', fixture));
    const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    await page.goto(s.url, { waitUntil: 'networkidle' });
    const layout = await page.evaluate(`(${layoutAudit})()`);
    const type = await page.evaluate(`(${typeAudit})()`);
    await page.close(); s.close();
    return { layout, type };
  };

  const broken = await run('broken', 375);
  console.log('\nfires on a broken page');
  test('detects horizontal overflow', () => assert.ok(broken.layout.overflow > 1, `overflow=${broken.layout.overflow}`));
  test('names the overflowing element', () => assert.ok(
    broken.layout.wide.some((w) => /too-wide/.test(w)), JSON.stringify(broken.layout.wide)));
  test('detects text under 12px', () => assert.ok(broken.layout.tiny.length > 0, JSON.stringify(broken.layout.tiny)));
  test('detects a small tap target', () => assert.ok(
    broken.layout.smallTaps.length > 0, JSON.stringify(broken.layout.smallTaps)));
  test('detects low contrast', () => {
    const issues = broken.type.flatMap((r) => typeIssues(r, 'iPhone 14', DEFAULTS));
    assert.ok(issues.some((i) => /below AA/.test(i)), JSON.stringify(issues));
  });

  const clean = await run('clean', 375);
  console.log('\nsilent on a clean page');
  test('no overflow', () => assert.ok(clean.layout.overflow <= 1, `overflow=${clean.layout.overflow}`));
  test('no tiny text', () => assert.equal(clean.layout.tiny.length, 0, JSON.stringify(clean.layout.tiny)));
  test('no small tap targets', () => assert.equal(clean.layout.smallTaps.length, 0, JSON.stringify(clean.layout.smallTaps)));
  test('no ragged lines', () => assert.equal(clean.layout.ragged.length, 0, JSON.stringify(clean.layout.ragged)));
  test('no typography findings', () => {
    const issues = clean.type.flatMap((r) => typeIssues(r, 'iPhone 14', DEFAULTS));
    assert.equal(issues.length, 0, JSON.stringify(issues));
  });
  // The three false-positive classes that made the original audit trustworthy.
  test('stacked block children are not read as ragged', () =>
    assert.ok(!clean.layout.ragged.some((r) => /stacked/.test(r)), JSON.stringify(clean.layout.ragged)));

  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
