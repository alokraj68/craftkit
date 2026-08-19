# pagecheck

Audit built pages for the defects a desktop review never sees.

[![CI](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml/badge.svg)](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40alokraj68%2Fpagecheck.svg?logo=npm&color=0b7285)](https://www.npmjs.com/package/@alokraj68/pagecheck)
[![install size](https://packagephobia.com/badge?p=@alokraj68/pagecheck)](https://packagephobia.com/result?p=@alokraj68/pagecheck)
[![tests](https://img.shields.io/badge/tests-21-2EA043.svg)](#testing)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-2EA043.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >=18](https://img.shields.io/badge/Node-%3E%3D18-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![peer: playwright](https://img.shields.io/badge/peer-playwright-2EAD33.svg?logo=playwright)](https://playwright.dev)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-D97757.svg)](https://github.com/alokraj68/craftkit)

Renders every page at phone and desktop widths and reports horizontal overflow,
ragged line endings, text too small to read, tap targets under 44px, and
typography that misses WCAG AA.

```bash
npx @alokraj68/pagecheck ./dist
npx @alokraj68/pagecheck https://example.com
```

```
=== iPhone SE
  /pricing/
     OVERFLOW 124px - div.price-table -> 124px past edge
     tiny text: 11px - "All prices exclude VAT…"
     small tap target: 88x24 - "Compare plans"

=== typography
[mobile] <p> 13px / weight 400 / leading 1.45 / 43 cpl / 7.1:1
   13px too small
   /pricing/ /about/
```

## Install

```bash
npm i -D @alokraj68/pagecheck playwright
npx playwright install chromium
```

Playwright is a peer dependency, not a bundled one. It is a large download, and
most projects that want a layout audit already have it.

## What it checks

**Layout, at phone widths**

| | |
|---|---|
| Overflow | Horizontal scroll, **and the element causing it**. Always a bug |
| Ragged lines | A wrapped line ending far short of the column. The final line is excluded, because a short last line is normal |
| Tiny text | Body copy under 12px |
| Tap targets | Interactive controls under 44px, excluding inline links inside a sentence |

**Typography, grouped per text style**

Font size, leading, weight, measure, and contrast against the first painted
ancestor background at 4.5:1 for body and 3:1 for display.

Findings group by **style**, not by element, so one bad style appearing on four
routes is one finding with four routes listed. Fix the style, not each instance.

## Why the numbers are trustworthy

Three classes of false positive had to be eliminated first. A layout audit that
cries wolf gets switched off, and then it catches nothing at all.

- **`getClientRects()` returns one rect per inline-block box, not one per
  rendered line.** An element holding `<b>`, an icon, or per-word animation
  spans reports a dozen "lines" for one, and every rag figure derived from it is
  meaningless. Rects are clustered into visual lines with a 4px tolerance
- **Scroll animations leave each element at its own transform mid-scrub.** All
  motion is frozen before anything is measured
- **Stacked block children are separate lines by design.** A title over a
  subtitle over a date is not badly wrapped prose, and measuring it that way
  reports the shortest block as a catastrophic gap

## Options

```
--layout-only / --type-only   run one audit
--json                        machine-readable output
--config <path>               default: pagecheck.config.json
--fail-on <a,b>               overflow,tiny,taps,rag,type  (default: overflow)
```

Only `overflow` fails the build by default, because it is unambiguously broken.
The rest are reported and left to judgement.

```json
{
  "minBodySize": 14,
  "maxCharsPerLine": 85,
  "failOn": ["overflow"],
  "viewports": [{ "name": "iPhone SE", "width": 375, "height": 667, "mobile": true }]
}
```

## In CI

```yaml
- run: npm run build
- run: npx @alokraj68/pagecheck ./dist
```

Exit code is 1 when a `failOn` category has findings, 0 otherwise.

## As a library

```js
import { typeIssues, DEFAULTS } from '@alokraj68/pagecheck';
```

The in-page audits are exported as string expressions for `page.evaluate()`;
the judgement half is a pure function, so it unit-tests without a browser.

## Testing

21 tests. Every check is asserted twice: it must fire on a page built to break
and stay silent on one that is well formed. Without Playwright installed, the 11
browser tests **skip silently** rather than fail, so read the count.


## 🧰 Part of craftkit

One of four tools in [craftkit](https://github.com/alokraj68/craftkit). Set all of
them up at once, picking only what you need:

```bash
npx @alokraj68/craftkit
```

| | | |
|---|---|---|
| ✍️ [`plainspoken`](https://www.npmjs.com/package/@alokraj68/plainspoken) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/plainspoken) | prose that does not read as machine-written |
| 📱 **`pagecheck`** | you are here | pages that survive a phone: overflow, tiny text, tap targets, WCAG AA |
| 📄 [`ats-resume`](https://www.npmjs.com/package/@alokraj68/ats-resume) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/ats-resume) | a résumé an applicant tracking system can parse, and JD gap analysis |
| 🧭 [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup) | skill only | verify before claiming done; never commit unasked |

### The skill ships with this package

`skills/page-audit/SKILL.md` is the judgement half: the calls a linter cannot make. It installs
as a Claude Code skill via the marketplace, and it is also in the npm tarball at
`node_modules/@alokraj68/pagecheck/skills/page-audit/SKILL.md`, so an agent can read it without the marketplace.

```
/plugin marketplace add alokraj68/craftkit
/plugin install pagecheck@craftkit
```

### Elsewhere

- 🛡️ [`eslint-plugin-typeorm-enterprise`](https://www.npmjs.com/package/eslint-plugin-typeorm-enterprise) — the same
  principle pointed at TypeORM: block raw SQL, require transactions, guard multi-tenant
  queries. Not part of craftkit; it fails a build the same way.
  [docs](https://github.com/alokraj68/eslint-plugin-typeorm-enterprise)
- 🌐 [alokraj68.in](https://alokraj68.in) — who writes these, and what they were built for.

## Licence

MIT
