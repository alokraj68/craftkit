#!/usr/bin/env node
// Audit built pages for the defects a desktop review never sees.
//
//   pagecheck ./dist            serve a build directory and audit every page
//   pagecheck https://site.com  audit a live URL
//
// Playwright is a peer dependency: it is a large download and most projects
// that want this already have it.
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { layoutAudit, typeAudit, typeIssues, DEFAULTS } from '../src/audit.mjs';

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`pagecheck - layout and typography audit for built pages

  pagecheck <dir|url> [...]

  --layout-only / --type-only   run one audit
  --json                        machine-readable output
  --config <path>               default: pagecheck.config.json
  --fail-on <a,b>               overflow,tiny,taps,rag,type  (default: overflow)

Checks: horizontal overflow and its cause, ragged line endings, text under
12px, tap targets under 44px, plus font size, leading, weight, measure and
WCAG AA contrast per text style.`);
  process.exit(0);
}

const flag = (n) => args.includes(n);
const valueOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

let cfg = { ...DEFAULTS };
const configPath = valueOf('--config') ?? (existsSync('pagecheck.config.json') ? 'pagecheck.config.json' : null);
if (configPath && existsSync(configPath)) {
  Object.assign(cfg, JSON.parse(readFileSync(configPath, 'utf8')));
}
if (valueOf('--fail-on')) cfg.failOn = valueOf('--fail-on').split(',').map((s) => s.trim());

const consumed = new Set([valueOf('--config'), valueOf('--fail-on')].filter(Boolean));
const targets = args.filter((a) => !a.startsWith('-') && !consumed.has(a));
if (!targets.length) {
  console.error('pagecheck: give a build directory or a URL. See --help');
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('pagecheck: playwright is required.\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
};

/** Serve a directory and return its origin plus every index.html as a route. */
async function serveDir(dir) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    // Path traversal guard: a request for ../../etc/passwd must not escape root.
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.statusCode = 404; return res.end();
    }
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, r));
  const walk = (d = root, prefix = '/') => {
    const out = [];
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) out.push(...walk(full, prefix + name + '/'));
      else if (name === 'index.html') out.push(prefix);
    }
    return out.sort();
  };
  return { origin: `http://localhost:${server.address().port}`, routes: walk(), close: () => server.close() };
}

const sources = [];
for (const t of targets) {
  if (/^https?:\/\//.test(t)) {
    const u = new URL(t);
    sources.push({ origin: u.origin, routes: [u.pathname + u.search], close: () => {} });
  } else if (existsSync(t)) {
    sources.push(await serveDir(t));
  } else {
    console.error(`pagecheck: no such path: ${t}`);
    process.exit(2);
  }
}

const doLayout = !flag('--type-only');
const doType = !flag('--layout-only');
const browser = await chromium.launch();
const report = [];
const typeFindings = new Map();
let counts = { overflow: 0, rag: 0, tiny: 0, taps: 0, type: 0 };

for (const vp of cfg.viewports) {
  if (!doLayout && vp.mobile !== false && vp.name !== 'desktop') { /* still needed for type */ }
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
  });
  for (const src of sources) {
    for (const route of src.routes) {
      try {
        await page.goto(src.origin + route, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (err) {
        report.push({ vp: vp.name, route, issues: [`load failed: ${err.message.split('\n')[0]}`] });
        continue;
      }
      await page.waitForTimeout(cfg.settleMs);

      if (doLayout && vp.mobile) {
        const r = await page.evaluate(`(${layoutAudit})()`);
        const issues = [];
        if (r.overflow > 1) {
          issues.push(`OVERFLOW ${r.overflow}px${r.wide.length ? ' - ' + r.wide.join('; ') : ''}`);
          counts.overflow++;
        }
        if (r.emptySpans) issues.push(`${r.emptySpans} empty word-span(s)`);
        for (const x of r.ragged) { issues.push(`ragged: ${x}`); counts.rag++; }
        for (const x of r.tiny) { issues.push(`tiny text: ${x}`); counts.tiny++; }
        for (const x of r.smallTaps) { issues.push(`small tap target: ${x}`); counts.taps++; }
        report.push({ vp: vp.name, route, issues });
      }

      if (doType) {
        for (const row of await page.evaluate(`(${typeAudit})()`)) {
          const issues = typeIssues(row, vp.name, cfg);
          if (!issues.length) continue;
          const key = `${vp.name}|${row.tag}|${row.size}|${row.weight}|${row.leading}|${row.contrast}`;
          const f = typeFindings.get(key) ?? { vp: vp.name, ...row, routes: new Set(), issues };
          f.routes.add(route);
          typeFindings.set(key, f);
        }
      }
    }
  }
  await page.close();
}
await browser.close();
for (const s of sources) s.close();

counts.type = typeFindings.size;

if (flag('--json')) {
  console.log(JSON.stringify({
    layout: report,
    typography: [...typeFindings.values()].map((f) => ({ ...f, routes: [...f.routes] })),
    counts,
  }, null, 2));
} else {
  if (doLayout) {
    let vp = null;
    for (const row of report) {
      if (row.vp !== vp) { vp = row.vp; console.log(`\n=== ${vp}`); }
      if (!row.issues.length) console.log(`  ${row.route}  clean`);
      else {
        console.log(`  ${row.route}`);
        for (const i of row.issues) console.log(`     ${i}`);
      }
    }
  }
  if (doType && typeFindings.size) {
    console.log('\n=== typography\n' + '='.repeat(64));
    for (const f of [...typeFindings.values()].sort((a, b) => a.vp.localeCompare(b.vp) || a.size - b.size)) {
      console.log(`\n[${f.vp}] <${f.tag}> ${f.size}px / weight ${f.weight} / leading ${f.leading} / ${f.cpl} cpl / ${f.contrast}:1`);
      console.log(`   ${f.issues.join(' · ')}`);
      console.log(`   ${[...f.routes].slice(0, 4).join(' ')}${f.routes.size > 4 ? ` +${f.routes.size - 4}` : ''}`);
      console.log(`   e.g. "${f.sample}…"`);
    }
  }
  const layoutIssues = report.reduce((n, r) => n + r.issues.length, 0);
  console.log(`\npagecheck: ${layoutIssues} layout issue(s), ${counts.overflow} overflow(s), ${typeFindings.size} type finding(s)`);
}

const failed = cfg.failOn.some((k) => (counts[k] ?? 0) > 0);
process.exit(failed ? 1 : 0);
