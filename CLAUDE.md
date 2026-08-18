# craftkit

Quality gates for shipping work, packaged as Claude Code plugins, plus a curated
list of the third-party skills they grew up alongside.

Four plugins, each independently useful and independently installable:

| Plugin | Ships | What it does |
|---|---|---|
| `craft-setup` | skill only | The working agreement: verify before done, never commit unasked, enforce in code not prose |
| `plainspoken` | skill + `plainspoken` CLI | Fails the build when prose reads as machine-written |
| `pagecheck` | skill + `pagecheck` CLI | Fails the build when a page breaks on a phone or misses WCAG AA |
| `ats-resume` | skill + `ats-resume` CLI | Fails when an applicant tracking system cannot parse the résumé |

```
craftkit/
  .claude-plugin/marketplace.json   the four plugins, by relative path
  plugins/
    craft-setup/                    skill only, no code
    plainspoken/                    npm package + skill
      src/rules.mjs                 the rule set, and why each one earned a place
      src/analyze.mjs               document -> the units the rules judge
      src/lint.mjs                  the runner, severity and suppression
      bin/plainspoken.mjs           CLI
      test/run.mjs                  33 tests
    pagecheck/                      npm package + skill
      src/audit.mjs                 the two in-page audits, plus pure rule helpers
      bin/pagecheck.mjs             CLI: serves a dir or hits a URL
      test/run.mjs                  21 tests
    ats-resume/                     npm package + skill
      src/rules.mjs                 what an ATS does, and the executive signals
      src/normalize.mjs             JSON Resume -> the units the checks judge
      src/lint.mjs                  source pass, extraction pass, tailoring
      bin/ats-resume.mjs            CLI: lint, tailor
      test/run.mjs                  37 tests
  toolkit/
    skills.json                     the curated set, by reference
    install.mjs                     interactive picker
```

---

## The two rules this repo exists to enforce

Everything here follows from these. Break either and the tool is worse than
nothing.

### 1. A checker that fires on correct work is worse than no checker

It trains everyone to ignore it, and then it catches nothing.

This is not theoretical. A published ~980-line de-slop catalogue, run against
real technical writing, produced nine hits and **eight were false positives** —
it read "ported from Java to C#" as a false range and "Australia, Europe and the
US" as tricolon abuse. Both are facts. Only the seven patterns that scored zero
false positives were kept.

The same lesson shaped `pagecheck`. Three classes of false positive had to be
eliminated before its numbers meant anything:

- `getClientRects()` returns one rect per inline-block box, not one per rendered
  line, so an element containing `<b>`, an icon or per-word animation spans
  reports a dozen "lines" for one.
- Scroll animations leave each element at its own transform mid-scrub.
- Stacked block children (a title over a subtitle over a date) are separate
  lines by design; measured as wrapped prose the shortest reads as a huge gap.

**So: every new rule must be run against real known-good work before it ships.**
If the false positive rate cannot be driven to roughly zero, it ships as a
warning, never a gate.

### 2. Fixed patterns gate. Heuristics advise.

`SEVERITY` in `plainspoken/src/rules.mjs` splits these deliberately:

- **error** — a fixed phrase with no defensible use. `"proven track record"` is
  never correct.
- **warn** — a ratio or a rhythm. A short factual README legitimately trips the
  abstraction ratio, and failing a build over that is exactly how a linter gets
  deleted.

`--preset resume` promotes the ratios to gates, because a CV is a list of claims
where every bullet really should name something. That is a deliberate,
documented exception, not the default.

---

## Testing

All three suites assert **twice**: a rule must fire on input built to trip it *and*
stay silent on input that is merely factual. The second half is the one that
matters.

```
npm test                                 # all three suites

node plugins/plainspoken/test/run.mjs    # 33 tests
node plugins/ats-resume/test/run.mjs     # 37 tests
node plugins/pagecheck/test/run.mjs      # 21 tests
```

`pagecheck` needs a browser for 11 of its 21 tests and **skips them silently**
rather than failing when Playwright is absent, so a green run of 10 is not the
same as a green run of 21. Read the count. For the full suite:

```
npm i --no-save playwright && npx playwright install chromium
```

CI installs it, so the full 21 always run there.

Fixtures are paired on purpose:

| Fires | Silent |
|---|---|
| `plainspoken/test/fixtures/slop.md` | `.../clean.md` |
| `pagecheck/test/fixtures/broken/` | `.../clean/` |
| `ats-resume/test/fixtures/broken.json` | `.../good.json` |

`clean.md` and `clean/index.html` are the important files. If a change makes
either produce a finding, the change is wrong until proven otherwise.

`plainspoken` also lints its own README and skill in CI. A prose linter that
cannot survive its own documentation is not usable.

---

## House rules

### ats-resume takes JSON Resume as given

The schema is jsonresume.org's, and it is not ours to extend. Adding a bespoke
field would make every résumé written for this tool unusable anywhere else,
which is the whole reason a standard was adopted instead of inventing a shape.
If something cannot be expressed in the schema, it belongs in the linter's
config, not in the data.

### Zero runtime dependencies

`plainspoken` and `ats-resume` have none at all. `pagecheck` takes Playwright as a **peer**
dependency, optional to install, because it is a large download and most
projects that want a layout audit already have it. Neither should ever gain a
runtime dependency for parsing, colour maths or CLI formatting — all three are
small enough to own.

Node >= 18, ESM only, no build step.

### The analyzer matters more than the rules

`plainspoken/src/analyze.mjs` decides what counts as prose. Getting it wrong
produces noise no rule tuning can fix. It must keep doing all of this:

- Blank out code fences, inline code, frontmatter, URLs, link targets, HTML tags
  and tables **while preserving byte offsets**, so reported line numbers still
  point at the original file.
- Treat a blank line as a sentence boundary. Without it a heading, a stripped
  code block and the paragraph after it fuse into one unit and every finding
  inside is reported at the wrong line.
- Treat list items as their own units. They usually have no full stop, so
  otherwise they merge into the next paragraph and escape every rule anchored
  to the end of a sentence.
- Never split on `Node.js`, `e.g.`, an initial, or a decimal.

There are tests for each. Do not weaken one to make a rule fire.

### Report at the match, not the unit

A finding's line comes from the offset of the regex match plus the unit's
offset. Reporting the start of the sentence puts the error on the wrong line as
soon as a unit spans more than one.

### Every rule carries its reason

`rules.mjs` is commented with why each pattern survived. When adding one, say
what it caught and what it was tested against. A rule with no recorded reason
gets deleted by the next person, or worse, kept without anyone knowing why.

### Suppression is a feature, not a leak

A document about banned phrases has to be able to quote them — this repo's own
skill files do. `<!-- plainspoken-disable-next-line -->` exists for that, and
the convention is to write the reason on the same line. A suppression with a
reason is documentation; one without is a checker being switched off.

### No eval in shipped code

`pagecheck` passes its audits to `page.evaluate()` as string expressions. That
is deliberate, and it is why the audits live as exported template literals in
`audit.mjs` rather than as functions. Pure, testable logic (`typeIssues`) stays
outside the page so it can be unit-tested without a browser.

---

## Third-party skills: reference, never vendor

`toolkit/skills.json` curates the set. **Nothing third-party is copied into this
repo, and nothing should be.**

Of the 47 skills this was drawn from, 26 carry **no licence file at all**, which
under copyright means the author kept every right. Public is not the same as
free to redistribute. `toolkit/install.mjs` clones from each upstream instead,
which keeps the author's name on the work and lets their fixes reach users.

Only AgriciDaniel's SEO set carries an explicit licence (MIT).

Two mechanics, and they are not interchangeable:

- **Plugins** (caveman, ponytail, ui-ux-pro-max, the official set) install with
  `/plugin marketplace add owner/repo`. Listed under `marketplaces`.
- **Skills-only repos** (impeccable, the Emil Kowalski set, karpathy, the SEO
  suite) have no plugin manifest and must be copied into `~/.claude/skills/`.
  Listed under `skills`.

Two details the installer handles and a manual copy gets wrong:

- A skill must be installed under its **declared `name:`**, not its directory
  name. `leonxlnx/taste-skill` ships in `taste-skill` but declares
  `design-taste-frontend`.
- **`impeccable` must run its own installer.** Its `SKILL.md` is generated from
  `SKILL.src.md` and still holds `{{scripts_path}}` placeholders, so a plain
  copy installs a broken skill. It is the only exception to "never run a repo's
  own installer".

Nothing installs without an explicit choice and a confirmation prompt. These run
with full agent permissions.

---

## Publishing

Each plugin is independently publishable to npm from its own directory
(`plugins/plainspoken`, `plugins/pagecheck`). Version them independently; a
change to one is not a reason to bump the other.

`craft-setup` ships no code and is never published to npm.

Marketplace entries in `.claude-plugin/marketplace.json` use **relative paths**,
so adding the repo as a marketplace exposes all three without any of them being
fetched separately.

---

## Working agreement

The rules in `plugins/craft-setup/skills/craft-setup/SKILL.md` apply to this
repo too, and they are not decoration here:

- **Verify before claiming done.** Run the tests, show the output. "It should
  work" is not a result.
- **Never commit or push without being asked in that message.** A prior "yes"
  does not carry forward.
- **Never weaken a gate to make something pass.** Fix the input.
- **Test a new rule against a known-bad input**, confirm it fails, then revert.
- A skill is advice, not authority. This file wins on conflict.
