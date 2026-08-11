#!/usr/bin/env node
// Check that a machine can read your résumé, and whether it matches a posting.
//
//   ats-resume lint resume.json
//   ats-resume lint resume.txt            text pulled out of a built PDF
//   ats-resume lint resume.pdf            page count + text layer
//   ats-resume tailor resume.json jd.txt
import { readFileSync, existsSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { lintResume, lintExtracted, lintFilename, tailor, pdfPageCount } from '../src/lint.mjs';

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || args.includes('-h') || args.includes('--help')) {
  console.log(`ats-resume - make sure a machine can read your résumé

  ats-resume lint <resume.json>          check the source (JSON Resume schema)
  ats-resume lint <resume.txt>           check what an ATS actually receives
  ats-resume lint <resume.pdf>           page count and text-layer size
  ats-resume tailor <resume.json> <jd>   match against a job description

  --json            machine-readable output
  --max-pages <n>   page budget for a PDF (default 2)
  --quiet           findings only

resume.json follows the JSON Resume schema: https://jsonresume.org

To check a PDF properly, extract its text first - that is what an ATS reads:
  pdftotext -layout resume.pdf resume.txt && ats-resume lint resume.txt`);
  process.exit(cmd ? 0 : 2);
}

const flag = (n) => args.includes(n);
const valueOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const asJson = flag('--json');
const files = args.slice(1).filter((a) => !a.startsWith('-') && a !== valueOf('--max-pages'));

const read = (p) => {
  if (!existsSync(p)) { console.error(`ats-resume: no such file: ${p}`); process.exit(2); }
  return p;
};

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m', dim: '\x1b[2m', green: '\x1b[32m', off: '\x1b[0m' }
  : { red: '', yellow: '', blue: '', dim: '', green: '', off: '' };

const TAG = {
  error: `${C.red}error${C.off}`,
  warn: `${C.yellow}warn ${C.off}`,
  info: `${C.blue}ask  ${C.off}`,
};

function report(findings, heading) {
  if (heading) console.log(`\n${heading}`);
  for (const f of findings) {
    console.log(`  ${TAG[f.severity] ?? f.severity} ${f.rule.padEnd(20)} ${f.message}`);
    if (f.evidence) console.log(`        ${C.dim}${String(f.evidence).replace(/\s+/g, ' ').slice(0, 90)}${C.off}`);
  }
}

if (cmd === 'lint') {
  const file = read(files[0] ?? '');
  const ext = extname(file).toLowerCase();
  let findings = [];
  let extra = {};

  if (ext === '.json') {
    let resume;
    try {
      resume = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`ats-resume: ${file} is not valid JSON - ${err.message}`);
      process.exit(2);
    }
    const res = lintResume(resume);
    findings = res.findings;
    extra = {
      roles: res.normalized.roles.length,
      highlights: res.normalized.highlights.length,
      skills: res.normalized.skills.length,
    };
    if (!asJson) {
      report(findings.filter((f) => f.severity !== 'info'), file);
      const asks = findings.filter((f) => f.severity === 'info');
      if (asks.length) {
        console.log(`\n  ${asks.length} signal(s) a hiring manager will look for and not find:`);
        report(asks);
        console.log(`  ${C.dim}These are questions, not defects. Answer them once and every format picks it up.${C.off}`);
      }
    }
  } else if (ext === '.pdf') {
    const buf = readFileSync(file);
    const pages = pdfPageCount(buf);
    const budget = Number(valueOf('--max-pages') ?? 2);
    if (pages > budget) {
      findings.push({ severity: 'error', rule: 'page-budget', message: `${pages} pages, budget is ${budget}` });
    }
    // A rough text-layer probe without a PDF parser: an image-only export has
    // almost no readable text between stream markers.
    const readable = (buf.toString('latin1').match(/\(([^)\\]{2,})\)/g) ?? []).join('').length;
    if (readable < 400) {
      findings.push({
        severity: 'warn', rule: 'text-layer',
        message: 'little extractable text found. If this was exported as an image, every ATS scores it zero',
      });
    }
    findings.push(...lintFilename(file));
    extra = { pages, budget };
    if (!asJson) {
      report(findings, file);
      console.log(`\n  ${pages} page(s). For a real check, extract the text:`);
      console.log(`  ${C.dim}pdftotext -layout ${basename(file)} out.txt && ats-resume lint out.txt${C.off}`);
    }
  } else {
    const text = readFileSync(file, 'utf8');
    const res = lintExtracted(text);
    findings = [...res.findings, ...lintFilename(file)];
    extra = { words: res.words, characters: text.length };
    if (!asJson) report(findings, file);
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  if (asJson) console.log(JSON.stringify({ file, findings, ...extra, errors, warnings }, null, 2));
  else if (!flag('--quiet')) {
    if (!errors && !warnings) console.log(`\n  ${C.green}nothing blocking${C.off}`);
    console.log(`\n${errors} error(s), ${warnings} warning(s)`);
  }
  process.exit(errors ? 1 : 0);
}

if (cmd === 'tailor') {
  const resumeFile = read(files[0] ?? '');
  const jdFile = read(files[1] ?? '');
  const resume = JSON.parse(readFileSync(resumeFile, 'utf8'));
  const jd = readFileSync(jdFile, 'utf8');
  const r = tailor(resume, jd);

  if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

  const pct = Math.round(r.matchRate * 100);
  const colour = r.verdict === 'pass' ? C.green : r.verdict === 'marginal' ? C.yellow : C.red;
  console.log(`\nmatch rate  ${colour}${pct}%${C.off}  (${r.verdict})`);
  console.log(`${C.dim}70%+ passes, 60-69% is marginal, below 60% is usually filtered before a human reads it.${C.off}`);

  if (r.fatalGaps.length) {
    console.log(`\n${C.red}fatal gaps${C.off} - repeated in the posting, absent from your résumé:`);
    for (const g of r.fatalGaps) console.log(`  ${g.term}  (${g.count}x in the JD)`);
    console.log(`${C.dim}No rewording fixes these. Decide whether the claim is true and unwritten, true but weak, or not true.${C.off}`);
  }

  console.log(`\nmissing (${r.missing.length}):`);
  console.log('  ' + r.missing.slice(0, 24).map((m) => m.term).join(', ') || '  none');

  console.log(`\nlead with:`);
  for (const l of r.leadWith) console.log(`  ${String(l.hits).padStart(3)} matching terms  ${l.role}`);

  console.log(`\n${C.dim}The gap list is the interview prep list, and it matters more than the score.${C.off}`);
  process.exit(0);
}

console.error(`ats-resume: unknown command "${cmd}". See --help`);
process.exit(2);
