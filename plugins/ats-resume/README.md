# ats-resume

Check that an applicant tracking system can actually read your résumé, and
whether it matches the posting you are about to apply to.

[![CI](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml/badge.svg)](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40alokraj68%2Fats-resume.svg?logo=npm&color=0b7285)](https://www.npmjs.com/package/@alokraj68/ats-resume)
[![install size](https://packagephobia.com/badge?p=@alokraj68/ats-resume)](https://packagephobia.com/result?p=@alokraj68/ats-resume)
[![tests](https://img.shields.io/badge/tests-37-2EA043.svg)](#testing)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-2EA043.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >=18](https://img.shields.io/badge/Node-%3E%3D18-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![JSON Resume](https://img.shields.io/badge/schema-JSON%20Resume-blue.svg)](https://jsonresume.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-D97757.svg)](https://github.com/alokraj68/craftkit)

Zero dependencies. Built on the [JSON Resume](https://jsonresume.org) schema, so
you bring a `resume.json` you may already have rather than learning another
format.

```
npx @alokraj68/ats-resume lint resume.json
npx @alokraj68/ats-resume tailor resume.json posting.txt
```

## This is not a writing checker

`plainspoken` asks whether prose reads as machine-written. This asks whether a
machine can parse the file at all. The two are deliberately separate tools.

## What it checks

**Source (`resume.json`)**

- Contact fields a parser needs, and a location field holding five cities.
- A promotion chain in the position field — `Junior Dev → Developer → Lead`
  parses as one garbled job title.
- Em and en dashes anywhere in a parsed field.
- Non-ISO dates. Date extraction is the most fragile part of parsing.
- Decorative glyphs, invented headings, missing sections.
- Acronyms appearing without their expansion, and the reverse.
- How many bullets carry a number.
- Eight executive signals, reported as **questions, not defects** — team size,
  hiring, retention, budget, revenue, scale, delivery speed, strategy.

**Extracted text — what an ATS actually receives**

```
pdftotext -layout Sam-Rivera-Resume.pdf out.txt
npx @alokraj68/ats-resume lint out.txt
```

- Is there a text layer at all? An image-only PDF scores zero everywhere.
- Did the standard headings survive?
- **Did the contact block keep its separators?** Flexbox gaps do not exist in
  extracted text, and standalone separator elements can be dropped from a PDF's
  text layer entirely — leaving one unsplittable string where a parser expected
  four fields. This looks perfect in the DOM and on screen. Only reading the
  extraction finds it.
- Em-dash date ranges, decorative glyphs, keyword stuffing.

Stuffing is measured as **density**, not as a statistical outlier. On a
700-word document almost any word appearing ten times clears three sigma, which
made an earlier version fire on ordinary subject words. Real stuffing sits at
2.5%+ for a single term.

## Tailoring

```
$ npx @alokraj68/ats-resume tailor resume.json posting.txt

match rate  60%  (marginal)

fatal gaps - repeated in the posting, absent from your résumé:
  terraform  (3x in the JD)
  datadog    (3x in the JD)

lead with:
    4 matching terms  Lead Platform Engineer, Northwind
```

Terms are filtered to things the posting **names** — a word capitalised
mid-sentence is nearly always a technology or a company, while "heavily" and
"expected" never are. Without that filter the gap list fills with job-ad
boilerplate, and a gap list nobody reads is worth nothing.

The gap list matters more than the score. Each missing term has three honest
outcomes: true and unwritten (add it where the work happened), true but weak
(mention it once), or not true (leave it out — that is your interview prep
list). Only the first is a wording fix.

## Exit codes

`1` on any error, `0` otherwise. `--json` for machine-readable output.

## Testing

37 tests. Every check is asserted twice: it must fire on a résumé built to break
parsing **and** stay silent on one that is simply well formed.

```
node test/run.mjs
```

## 🧰 Part of craftkit

One of four tools in [craftkit](https://github.com/alokraj68/craftkit). Set all of
them up at once, picking only what you need:

```bash
npx @alokraj68/craftkit
```

| | | |
|---|---|---|
| ✍️ [`plainspoken`](https://www.npmjs.com/package/@alokraj68/plainspoken) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/plainspoken) | prose that does not read as machine-written |
| 📱 [`pagecheck`](https://www.npmjs.com/package/@alokraj68/pagecheck) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/pagecheck) | pages that survive a phone: overflow, tiny text, tap targets, WCAG AA |
| 📄 **`ats-resume`** | you are here | a résumé an applicant tracking system can parse, and JD gap analysis |
| 🧭 [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup) | skill only | verify before claiming done; never commit unasked |

### The skill ships with this package

`skills/tailor-resume/SKILL.md` is the judgement half: the calls a linter cannot make. It installs
as a Claude Code skill via the marketplace, and it is also in the npm tarball at
`node_modules/@alokraj68/ats-resume/skills/tailor-resume/SKILL.md`, so an agent can read it without the marketplace.

```
/plugin marketplace add alokraj68/craftkit
/plugin install ats-resume@craftkit
```

### Elsewhere

- 🛡️ [`eslint-plugin-typeorm-enterprise`](https://www.npmjs.com/package/eslint-plugin-typeorm-enterprise) — the same
  principle pointed at TypeORM: block raw SQL, require transactions, guard multi-tenant
  queries. Not part of craftkit; it fails a build the same way.
  [docs](https://github.com/alokraj68/eslint-plugin-typeorm-enterprise)
- 🌐 [alokraj68.in](https://alokraj68.in) — who writes these, and what they were built for.

## Licence

MIT
