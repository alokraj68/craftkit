---
name: page-audit
description: Audit a built page or site for layout and typography defects - horizontal overflow, ragged line endings, text too small to read, tap targets under 44px, and contrast or measure that fails WCAG AA. Use when checking mobile layout, reviewing typography, debugging why a page breaks on a phone, or before shipping a frontend change.
---

# Page audit

Run the measurement, then read the result. Do not eyeball a layout and call it
checked.

```
npx pagecheck ./dist            # serve a build and audit every page
npx pagecheck https://site.com  # audit a live URL
npx pagecheck ./dist --layout-only
npx pagecheck ./dist --fail-on overflow,tiny
```

Requires Playwright (`npm i -D playwright && npx playwright install chromium`).

## What it measures

**Layout, at phone widths**

- Horizontal overflow, and which element causes it. Always a bug.
- Ragged line endings: a wrapped line ending far short of the column reads as
  stray whitespace on a phone. The final line is excluded, because a short last
  line is normal.
- Text under 12px.
- Tap targets under 44px, excluding inline links inside a sentence.

**Typography, per text style**

- Font size, leading, weight, measure (characters per line).
- Contrast against the first painted ancestor background, checked at 4.5:1 for
  body and 3:1 for display.

## Reading the output

`overflow` is the only default gate, because it is unambiguously broken. The
rest are reported and left to judgement — that is deliberate, not laziness.

Findings group by text **style**, not by element, so "13px / weight 400 /
7.1:1" appearing on four routes is one finding with four routes listed. Fix the
style, not each instance.

## Defects worth knowing about

**A width query that hits print.** Chromium renders A4 at roughly 794 CSS
pixels, so a bare `@media (max-width: 900px)` rule applies to generated PDFs as
well as phones. Scope every narrow-screen rule as
`@media screen and (max-width: …)`. A tap-target fix once pushed a one-page
document to two pages this way.

**A flex line stretching its children.** `align-items` defaults to `stretch`, so
one chip wrapping to two lines drags every chip beside it to the same height.
If elements that should be identical measure differently, check the parent
before the child.

**A translucent fill over a gradient.** `bg-white/5` over a background wash
picks up whatever is behind it, so the same component reads warm at the top of a
page and cool further down. Use a solid token when consistency matters.

**`overflow: hidden` clipping a tooltip.** Setting one axis to `hidden` forces
the other to `auto`. Use `overflow-x: clip` with `overflow-y: visible` when
something must escape vertically while horizontal scroll stays blocked.

## When a finding is wrong

Tune the threshold in `pagecheck.config.json`, and write down why:

```json
{
  "minBodySize": 14,
  "maxCharsPerLine": 85,
  "failOn": ["overflow"]
}
```

Do not silence a whole rule to clear a single finding. If the checker is wrong
often enough to be annoying, the fix is to make it quieter and more accurate,
not to switch it off — a checker nobody trusts catches nothing.

## Before saying a layout is fixed

Re-run the audit and show the output. A layout change that was not re-measured
has not been verified, and this is the exact area where a desktop review reads
as fine while the phone is broken.

## Related skills

Part of [craftkit](https://github.com/alokraj68/craftkit). Reach for these when
the task moves outside this one:

| Skill | Tool | For |
|---|---|---|
| [`plain-writing`](https://github.com/alokraj68/craftkit/tree/main/plugins/plainspoken/skills/plain-writing) | `npx plainspoken` | prose that does not read as machine-written |
| [`tailor-resume`](https://github.com/alokraj68/craftkit/tree/main/plugins/ats-resume/skills/tailor-resume) | `npx ats-resume` | résumé parseability and job-description matching |
| [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup/skills/craft-setup) | skill only | the working agreement: verify before claiming done |

Install any of them, or all four, with `npx craftkit`.
