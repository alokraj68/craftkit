// A rule that has only ever passed is not a rule. Every check here is asserted
// twice: it must fire on writing built to trip it, and stay silent on writing
// that is merely factual. The second half is the one that matters - the reason
// most of the deslop catalogue was left out is that it fails it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { lint } from '../src/lint.mjs';
import { sentences, stripNonProse, isPassive, isConcrete } from '../src/analyze.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'fixtures', f), 'utf8');

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};

const slop = lint(read('slop.md'));
const clean = lint(read('clean.md'));
const rules = (r) => new Set(r.findings.map((f) => f.rule));
const has = (r, rule) => rules(r).has(rule);

console.log('\nfires on slop');
for (const rule of [
  'ai-phrase', 'prose-tell', 'adjective-pair', 'tech-list-tail',
  'vague-tail', 'filler-phrase', 'passive-voice', 'repeated-opener',
]) {
  test(rule, () => assert.ok(has(slop, rule), `expected ${rule}, got: ${[...rules(slop)].join(', ')}`));
}
test('exits with errors', () => assert.ok(slop.stats.errors > 0));

console.log('\nsilent on facts');
test('no findings at all', () => assert.equal(
  clean.findings.length, 0,
  `expected clean, got:\n${clean.findings.map((f) => `        ${f.rule}: ${f.message}`).join('\n')}`,
));

console.log('\nthe false positives that kept deslop out');
const quiet = (text, label) => test(label, () => {
  const r = lint(text);
  assert.equal(r.findings.length, 0, `${label} flagged: ${r.findings.map((f) => f.rule + ' ' + f.message).join('; ')}`);
});
quiet('We ported the importer from Java to C# in April 2019.', 'a real port is not a false range');
quiet('The team shipped in Australia, Europe and the US last year.', 'a list of places is not tricolon abuse');
quiet('It runs on Node 24, Postgres 16 and Redis 7 across 3 regions.', 'a factual stack list');

console.log('\nnon-prose is not linted');
test('code fence ignored', () => {
  const r = lint('```\nproven track record of leverage\n```\n\nRedis 7 shipped in Kochi on 4 May.\n');
  assert.equal(r.findings.length, 0, JSON.stringify(r.findings));
});
test('inline code ignored', () => {
  const r = lint('The flag `--proven-track-record` was renamed in v2 by Ravi.\n');
  assert.ok(!has(r, 'ai-phrase'));
});
test('frontmatter ignored', () => {
  const r = lint('---\nsummary: leverage a robust proven track record\n---\n\nRedis 7 shipped in Kochi on 4 May.\n');
  assert.equal(r.findings.length, 0, JSON.stringify(r.findings));
});
test('url ignored', () => {
  const r = lint('Docs live at https://x.dev/proven-track-record-2 for Ravi.\n');
  assert.ok(!has(r, 'ai-phrase'));
});

console.log('\nsentence splitting');
test('does not split Node.js', () => {
  const s = sentences('We run Node.js in production. Redis too.');
  assert.equal(s.length, 2, JSON.stringify(s.map((x) => x.text)));
});
test('does not split e.g.', () => {
  const s = sentences('Some tools, e.g. Redis, are fast. Others are not.');
  assert.equal(s.length, 2, JSON.stringify(s.map((x) => x.text)));
});
test('does not split decimals', () => {
  const s = sentences('Revenue hit 4.5 million last year. That was 2019.');
  assert.equal(s.length, 2, JSON.stringify(s.map((x) => x.text)));
});

console.log('\nline numbers survive stripping');
test('offset maps to the right line', () => {
  const doc = '# Title\n\n```\ncode\n```\n\nWe have a proven track record here.\n';
  const r = lint(doc);
  const f = r.findings.find((x) => x.rule === 'ai-phrase');
  assert.ok(f, 'no ai-phrase finding');
  assert.equal(f.line, 7, `expected line 7, got ${f.line}`);
});

console.log('\nsuppression - a style guide must be able to quote its own banned list');
test('disable-next-line', () => {
  const r = lint('<!-- plainspoken-disable-next-line -->\nBanned: "responsible for" and "team player".\n');
  assert.equal(r.findings.length, 0, JSON.stringify(r.findings));
});
test('disable/enable block', () => {
  const doc = '<!-- plainspoken-disable -->\n- "responsible for"\n- "proven track record"\n<!-- plainspoken-enable -->\n\nRedis 7 shipped in Kochi on 4 May.\n';
  assert.equal(lint(doc).findings.length, 0, JSON.stringify(lint(doc).findings));
});
test('suppression does not leak past enable', () => {
  const doc = '<!-- plainspoken-disable -->\n"responsible for"\n<!-- plainspoken-enable -->\n\nWe have a proven track record.\n';
  assert.ok(lint(doc).findings.some((f) => f.rule === 'ai-phrase'));
});
test('allow list mutes a word', () => {
  assert.ok(!lint('We use Realm for storage.', { allow: ['realm'] }).findings.length);
});

console.log('\npresets');
const abstractDoc = 'We improved the overall experience.\nIt was better than before.\nThings got easier.\nUsers were happier.\nThe work went well.\nEverything improved.\n';
test('docs preset does not fail on abstraction', () => {
  const r = lint(abstractDoc);
  assert.ok(r.findings.some((f) => f.rule === 'abstraction'), 'expected the finding');
  assert.equal(r.stats.errors, 0, 'abstraction must not fail the docs preset');
});
test('resume preset does fail on abstraction', () => {
  const r = lint(abstractDoc, { preset: 'resume' });
  assert.ok(r.stats.errors > 0, 'expected abstraction to fail under resume');
});

console.log('\nhelpers');
test('passive detected', () => assert.ok(isPassive('The report was generated by the system.')));
test('state verb is not passive', () => assert.ok(!isPassive('She is interested in the results.')));
test('number counts as concrete', () => assert.ok(isConcrete('We cut latency to 45ms.')));
test('proper noun counts as concrete', () => assert.ok(isConcrete('We deployed to Cloudflare.')));
test('bare abstraction is not concrete', () => assert.ok(!isConcrete('We improved the overall experience.')));
test('stripNonProse keeps line count', () => {
  const doc = 'a\n```\nb\n```\nc\n';
  assert.equal(stripNonProse(doc).split('\n').length, doc.split('\n').length);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
