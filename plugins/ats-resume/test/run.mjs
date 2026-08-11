// Both halves asserted, as everywhere in this repo: the checks must fire on a
// résumé built to break parsing, and stay silent on one that is simply well
// formed. The second half is the one that keeps the tool usable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintResume, lintExtracted, lintFilename, tailor, pdfPageCount } from '../src/lint.mjs';
import { normalize, terms, mentions } from '../src/normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (f) => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};

const broken = lintResume(fixture('broken.json'));
const good = lintResume(fixture('good.json'));
const rules = (res) => new Set(res.findings.map((f) => f.rule));
const hasRule = (res, rule) => rules(res).has(rule);

console.log('\nfires on a resume built to break parsing');
for (const rule of [
  'contact', 'title-chain', 'dash', 'date-format', 'glyphs',
  'sections', 'quantified',
]) {
  test(rule, () => assert.ok(hasRule(broken, rule),
    `expected ${rule}; got: ${[...rules(broken)].join(', ')}`));
}
test('flags too many places in one location field', () =>
  assert.ok(broken.findings.some((f) => /too many places/.test(f.message))));
test('errors are blocking', () =>
  assert.ok(broken.findings.some((f) => f.severity === 'error')));

console.log('\nsilent on a well-formed resume');
test('no errors at all', () => {
  const errs = good.findings.filter((f) => f.severity === 'error');
  assert.equal(errs.length, 0, JSON.stringify(errs, null, 1));
});
test('no warnings at all', () => {
  const warns = good.findings.filter((f) => f.severity === 'warn');
  assert.equal(warns.length, 0, JSON.stringify(warns, null, 1));
});
test('ISO dates accepted', () => assert.ok(!hasRule(good, 'date-format')));
test('a single current role is not flagged', () => assert.ok(!hasRule(good, 'concurrent-roles')));

console.log('\nexecutive signals');
test('finds the signals a good resume states', () => {
  const missing = good.findings.filter((f) => f.rule === 'exec-signal').map((f) => f.message);
  assert.equal(missing.length, 0, `still missing: ${missing.join(' | ')}`);
});
test('reports them as questions, not errors', () => {
  const asks = broken.findings.filter((f) => f.rule === 'exec-signal');
  assert.ok(asks.length > 0);
  assert.ok(asks.every((f) => f.severity === 'info'));
});
// "retained 10 of them" states retention without using the noun. An earlier
// version keyed only on HR nouns and reported this as absent.
test('retention matches the verb form', () => {
  const r = lintResume({ work: [{ name: 'X', position: 'Y', startDate: '2020-01',
    highlights: ['Retained most of the founding team over 4 years'] }] });
  assert.ok(!r.findings.some((f) => f.rule === 'exec-signal' && /retention/.test(f.message)));
});

console.log('\nextracted text - what an ATS actually receives');
const goodText = `Sam Rivera | sam@example.com | +44 7700 900000 | Manchester, UK
Summary
Platform engineer running billing and event systems.
Experience
Lead Platform Engineer, Northwind    2021-03 - Present
- Cut p99 read latency from 340ms to 45ms with Cassandra
Skills
TypeScript, Node.js, Postgres, Cassandra, Kubernetes
Education
BSc Computer Science, University of Manchester
Projects
Billing platform rewrite, moving invoicing off a monolith and onto queues.
Event pipeline handling roughly forty thousand messages every minute at peak.
Migration from a single Postgres primary to a sharded estate across two regions.
Internal tooling for on-call rotas, incident review and capacity planning work.
Certifications
Certified Kubernetes Administrator, awarded 2022 and renewed during 2025.
Languages
English as a first language, plus conversational Polish learned in Krakow.
References available on request from previous managers at both companies.`;

test('accepts a well-formed extraction', () => {
  const r = lintExtracted(goodText);
  assert.equal(r.findings.filter((f) => f.severity === 'error').length, 0,
    JSON.stringify(r.findings, null, 1));
});
test('catches a fused contact block', () => {
  const r = lintExtracted(goodText.replace(/ \| /g, '  '));
  assert.ok(r.findings.some((f) => f.rule === 'contact-separators'));
});
test('catches an image-only PDF', () => {
  const r = lintExtracted('Sam Rivera');
  assert.ok(r.findings.some((f) => f.rule === 'text-layer'));
});
test('catches em-dash date ranges', () => {
  const r = lintExtracted(goodText.replace('2021-03 - Present', '2021 — Present'));
  assert.ok(r.findings.some((f) => f.rule === 'dash'));
});
test('catches decorative glyphs', () => {
  const r = lintExtracted(goodText.replace('- Cut p99', '✓ Cut p99'));
  assert.ok(r.findings.some((f) => f.rule === 'glyphs'));
});
// A 3-sigma test is meaningless on a 700-word document: almost any repeated
// word is an outlier. Density is the honest measure.
test('does not flag a normal subject word as stuffing', () => {
  const r = lintExtracted(goodText);
  assert.ok(!r.findings.some((f) => f.rule === 'stuffing'), JSON.stringify(r.findings));
});
test('does flag real stuffing', () => {
  const r = lintExtracted(goodText + '\n' + 'Kubernetes '.repeat(60));
  assert.ok(r.findings.some((f) => f.rule === 'stuffing'));
});

console.log('\nfilenames');
test('flags resume.pdf', () => assert.ok(lintFilename('resume.pdf').length > 0));
test('flags Final_v3', () => assert.ok(lintFilename('CV_Final_v3.docx').length > 0));
test('accepts a named file', () =>
  assert.equal(lintFilename('Sam-Rivera-Resume.pdf', 'Sam Rivera').length, 0));

console.log('\ntailoring');
const jd = `Senior Platform Engineer. You will own our Kubernetes estate and the
billing platform. Kubernetes experience is required. Strong Postgres and
Kubernetes skills. We use TypeScript, Terraform and Terraform modules heavily.
Terraform is central to how we work. Experience with Cassandra a plus.`;
const t = tailor(fixture('good.json'), jd);
test('counts covered terms', () => assert.ok(t.covered.some((c) => c.term === 'kubernetes')));
test('reports missing terms', () => assert.ok(t.missing.some((m) => m.term === 'terraform')));
test('flags a repeated missing term as fatal', () =>
  assert.ok(t.fatalGaps.some((g) => g.term === 'terraform'), JSON.stringify(t.fatalGaps)));
test('does not invent a fatal gap for a term mentioned once', () =>
  assert.ok(!t.fatalGaps.some((g) => g.count < 3)));
test('ranks which role to lead with', () => assert.ok(t.leadWith[0].hits >= t.leadWith[1]?.hits ?? 0));
test('gives a verdict', () => assert.ok(['pass', 'marginal', 'likely-filtered'].includes(t.verdict)));

console.log('\nhelpers');
test('matching is literal, not fuzzy', () => {
  assert.ok(mentions('We use React, daily', 'react'));
  assert.ok(!mentions('a reactive stream', 'react'));
});
test('normalize tolerates a near-empty resume', () => {
  const n = normalize({});
  assert.equal(n.roles.length, 0);
  assert.equal(n.highlights.length, 0);
});
test('an absent endDate means current', () => {
  const n = normalize({ work: [{ name: 'X', position: 'Y', startDate: '2020-01' }] });
  assert.equal(n.roles[0].current, true);
});
test('pdf page count reads object headers', () => {
  const fake = Buffer.from('%PDF-1.4\n/Type /Page\n/Type /Page\n/Type /Pages\n');
  assert.equal(pdfPageCount(fake), 2);
});
test('terms strips trailing punctuation', () => assert.ok(terms('Node.js, React.').includes('react')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
