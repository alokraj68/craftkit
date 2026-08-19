<div align="center">

# 🧰 craftkit

**Green means it was checked. Not that nobody looked.**

Four Claude Code plugins that turn "looks fine to me" into a build that fails. Prose that reads as machine-written, pages that break on a phone, résumés no parser can read, and agents that say "done" without running anything: each one gets a gate instead of a good intention.

[![CI](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml/badge.svg)](https://github.com/alokraj68/craftkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node >=18](https://img.shields.io/badge/Node-%3E%3D18-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![plugins](https://img.shields.io/badge/plugins-4-6E56CF.svg)](#-the-four-plugins)
[![tests](https://img.shields.io/badge/tests-91-2EA043.svg)](#-the-filter-every-rule-had-to-pass)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-2EA043.svg)](#-how-it-works)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-D97757.svg)](https://claude.com/claude-code)

```
npx craftkit
```

</div>

---

## ✨ Why craftkit?

Most quality tooling fails the same way: it fires on work that was already correct. One noisy run and everybody adds `--no-verify` to muscle memory. After that the checker catches nothing, forever.

So every rule here had to clear two bars, not one. **Fire on writing built to trip it, and stay silent on writing that is merely factual.** Both halves are in the test suite. The second half is why most of a well-known 980-line de-slop catalogue is *not* in this repo.

| | |
|---|---|
| ✍️ **`plainspoken`** | Fails the build when prose reads as machine-written. AI phrases, vague tails, paired adjectives, tool-list endings, abstraction ratios |
| 📱 **`pagecheck`** | Fails when a page breaks on a phone. Overflow and the element causing it, ragged lines, sub-12px text, tap targets under 44px, WCAG AA contrast |
| 📄 **`ats-resume`** | Fails when an applicant tracking system cannot parse the file. Built on the [JSON Resume](https://jsonresume.org) schema, with job-description gap analysis |
| 🧭 **`craft-setup`** | The working agreement. Verify before claiming done, never commit unasked, enforce in code rather than in a checklist |
| 🎒 **`toolkit/`** | 47 curated third-party skills, installed from upstream. Nothing vendored, nothing relicensed |
| 🪶 **Zero runtime deps** | `plainspoken` and `ats-resume` have none at all. `pagecheck` takes Playwright as an optional peer |

## 📚 Table of Contents

- [Requirements](#-requirements)
- [Install](#-install)
- [The four plugins](#-the-four-plugins)
- [The filter every rule had to pass](#-the-filter-every-rule-had-to-pass)
- [The curated toolkit](#-the-curated-toolkit)
- [How it works](#-how-it-works)
- [For AI coding agents](#-for-ai-coding-agents)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Credits](#-credits)
- [License](#-license)

## ✅ Requirements

- **Node** `>=18`, ESM only, no build step
- **Claude Code** for the plugin and skill half. The CLIs run standalone without it
- **Playwright** only for `pagecheck`, and only for the browser half of its tests

## 📦 Install

One command. It asks what you do on this machine, then installs only that.

```bash
npx craftkit
```

```
  What will you be doing on this machine?
  Pick any number of them.

    1  🎨  UI / UX and frontend design
    2  ✍️  Writing, docs and READMEs
    3  💻  Coding
    4  📄  Résumé and job search
    5  🔍  SEO and content strategy

  Whatever you pick, caveman and lean-ctx are installed too.

  Numbers (e.g. 1,3), "all", or blank to cancel:
```

It then enables the plugins by writing `settings.json`, clones the skills from
their own upstreams, and runs the two installers that cannot be a plain copy.

| | |
|---|---|
| 🎨 **ui** | frontend-design, ui-ux-pro-max, design-taste-frontend, nine Emil Kowalski motion skills, impeccable, `pagecheck` |
| ✍️ **writing** | `plainspoken` |
| 💻 **coding** | ponytail, karpathy-guidelines, `craft-setup` |
| 📄 **resume** | `ats-resume`, `plainspoken` |
| 🔍 **seo** | ~30 SEO skills |
| ⚙️ **always** | caveman, lean-ctx |

```bash
npx craftkit --list          # the whole catalogue, install nothing
npx craftkit ui coding       # skip the question
npx craftkit ui --dry-run    # show exactly what would happen
npx craftkit --all --yes     # everything, no prompts
npx craftkit writing --project   # write ./.claude/settings.json, not ~/
```

**Nothing runs before you have seen it.** The plan lists every plugin, every
repository, and the exact text of every command, including the one that pipes a
remote script into bash. Your `settings.json` is backed up before it is touched.

### Just the plugins

If you would rather skip the wizard:

```
/plugin marketplace add alokraj68/craftkit

/plugin install plainspoken@craftkit
/plugin install pagecheck@craftkit
/plugin install ats-resume@craftkit
/plugin install craft-setup@craftkit
```

Or install a CLI on its own:

```bash
npm i -D plainspoken
npm i -D pagecheck playwright
npm i -D ats-resume
```

## 🧩 The four plugins

### ✍️ plainspoken

[npm](https://www.npmjs.com/package/plainspoken) · [docs](./plugins/plainspoken) · [skill](./plugins/plainspoken/skills/plain-writing/SKILL.md)

Reads Markdown and plain text, so it works on docs, READMEs, release notes, landing copy and CVs alike.

```bash
node plugins/plainspoken/bin/plainspoken.mjs docs/
```

```
docs/architecture.md
  error   14  ai-phrase        "proven track record" has no defensible use
  error   31  vague-tail       trails off into a vague clause instead of landing on a result
        Built the reporting layer, enabling improved efficiency
  warn    22  ai-word          "leverage" - try: use, apply, draw on
```

| | |
|---|---|
| 🔴 **Errors** | Fixed phrases with no defensible use. `"proven track record"` is never correct |
| 🟡 **Warnings** | Ratios and rhythm. A short factual README trips the abstraction ratio, and failing a build over that is how a linter gets deleted |
| 🎚️ **Presets** | `docs` (default), `resume` (ratios become gates), `strict` (everything fails) |
| 🤫 **Suppression** | `<!-- plainspoken-disable-next-line -->`, because a style guide has to quote its own banned list |
| 🙈 **Never linted** | Code fences, inline code, frontmatter, URLs, link targets, HTML tags, tables, with line numbers still pointing at the original file |

### 📱 pagecheck

[npm](https://www.npmjs.com/package/pagecheck) · [docs](./plugins/pagecheck) · [skill](./plugins/pagecheck/skills/page-audit/SKILL.md)

```bash
node plugins/pagecheck/bin/pagecheck.mjs ./dist
node plugins/pagecheck/bin/pagecheck.mjs https://example.com
```

Catches horizontal overflow **and names the element causing it**, ragged line endings, text under 12px, tap targets under 44px, plus size, leading, weight, measure and contrast per text style.

Three false positives had to die before its numbers meant anything:

- `getClientRects()` returns one rect per inline-block box, not one per rendered line. An element holding `<b>`, an icon or per-word animation spans reports a dozen "lines" for one
- Scroll animations leave every element at its own transform mid-scrub
- Stacked block children (a title over a subtitle over a date) are separate lines by design, and read as a catastrophic gap when measured as wrapped prose

### 📄 ats-resume

[npm](https://www.npmjs.com/package/ats-resume) · [docs](./plugins/ats-resume) · [skill](./plugins/ats-resume/skills/tailor-resume/SKILL.md)

```bash
node plugins/ats-resume/bin/ats-resume.mjs lint resume.json
node plugins/ats-resume/bin/ats-resume.mjs tailor resume.json posting.txt
```

Two passes, because they catch different things. The **source pass** reads `resume.json` and finds promotion chains in the title field, non-ISO dates, glyphs a parser chokes on. The **extraction pass** reads the text pulled out of the built PDF and finds what source inspection cannot:

> Flexbox gaps do not exist in extracted text, and standalone separator elements can be dropped from a PDF's text layer entirely, leaving one unsplittable string where a parser expected four fields. It looks perfect in the DOM. Only reading the extraction finds it.

Tailoring filters job-description terms to what the posting **names**: a word capitalised mid-sentence is nearly always a technology, while "heavily" and "expected" never are. On a sample posting that dropped eleven noise terms and moved the reported match from 42% to 60%.

### 🧭 craft-setup

[docs](./plugins/craft-setup) · [skill](./plugins/craft-setup/skills/craft-setup/SKILL.md) · not on npm, no code to ship

Skill only, no code. What an agent does before it says a thing is done: run the typecheck, run the linter on every file it touched, run the build once, and **name what it could not verify** instead of implying it did.

Distilled from running agents across a résumé generator, an Angular ERP, a NestJS backend and several Flutter apps.

## 🧪 The filter every rule had to pass

**91 tests.** Every suite asserts twice — fire on input built to trip it, stay silent on input that is merely factual.

| Suite | Tests | Fires on | Silent on |
|---|---|---|---|
| `plainspoken` | 33 | `fixtures/slop.md` | `fixtures/clean.md` |
| `ats-resume` | 37 | `fixtures/broken.json` | `fixtures/good.json` |
| `pagecheck` | 21 | `fixtures/broken/` | `fixtures/clean/` |

```bash
npm test
```

The `clean` fixtures are the important ones. If a change makes any of them produce a finding, the change is wrong until proven otherwise.

Three of the tests exist purely to keep out patterns that looked reasonable and were not: a real port ("from Java to C#") is not a false range, a list of places ("Australia, Europe and the US") is not tricolon abuse, and a factual stack list is not slop.

`plainspoken` also lints this repository's own prose in CI. A prose linter that cannot survive its own README is not usable.

## 🎒 The curated toolkit

`toolkit/catalogue.json` is the whole set, grouped by what you do rather than by
who wrote it. `npx craftkit` reads it.

**Nothing third-party is vendored here.** Of the 47 skills this grew from, **26
carry no licence file at all**, which under copyright means the author kept every
right. Public is not the same as redistributable. The installer clones from each
upstream instead, so their name stays on the work and their fixes reach you.

Two details a manual copy gets wrong, and the installer does not:

- A skill installs under its **declared `name:`**, not its directory name.
  `leonxlnx/taste-skill` ships in `taste-skill` and declares
  `design-taste-frontend`
- **`impeccable` must run its own installer.** Its `SKILL.md` is generated from
  `SKILL.src.md` and still holds `{{scripts_path}}` placeholders, so a plain copy
  installs a broken skill

## 🧠 How it works

Plain ESM, no build step, no bundler. Each plugin is a directory under `plugins/` holding a `.claude-plugin/plugin.json`, a skill, and (for three of them) a CLI and its own `package.json`, so each publishes to npm independently.

Two design rules run through all of it:

**Fixed patterns gate, heuristics advise.** A phrase either appears or it does not. A ratio is a judgement, and judgements make bad gates.

**The analyzer matters more than the rules.** `plainspoken/src/analyze.mjs` decides what counts as prose, and getting it wrong produces noise no rule tuning can fix. It blanks non-prose while preserving byte offsets, treats a blank line as a sentence boundary, treats list items as their own units, and never splits on `Node.js`, `e.g.`, an initial or a decimal.

`pagecheck` hands its audits to `page.evaluate()` as string expressions, which is why they live as exported template literals. The pure, testable half stays outside the browser.

## 🤖 For AI coding agents

Every plugin ships a `SKILL.md` that is the agent-facing spec: the judgement a regex cannot encode, written to be read rather than parsed.

Every one also ships **inside its npm tarball**, so an agent can read it from
`node_modules/<pkg>/skills/` without ever touching the marketplace.

| Skill | Covers |
|---|---|
| [`plain-writing`](./plugins/plainspoken/skills/plain-writing/SKILL.md) | Why detectors flag abstraction rather than vocabulary, and the plain word to use instead |
| [`page-audit`](./plugins/pagecheck/skills/page-audit/SKILL.md) | Reading the output, and the layout defects worth knowing before you hit them |
| [`tailor-resume`](./plugins/ats-resume/skills/tailor-resume/SKILL.md) | The five readers, and the three honest outcomes for a missing keyword |
| [`craft-setup`](./plugins/craft-setup/skills/craft-setup/SKILL.md) | The working agreement itself |

Point your agent at this repo, or add a line to your own `AGENTS.md` / `CLAUDE.md`:

```md
Prose gates come from craftkit/plainspoken. Before claiming work is done,
follow craftkit/craft-setup: run the checks and name what went unverified.
```

## 🗺️ Roadmap

- [ ] Publish `craftkit`, `plainspoken`, `pagecheck` and `ats-resume` to npm
- [ ] Retire the duplicated copies still living in [alokraj68.in](https://github.com/alokraj68/alokraj68.in) once the packages are published
- [ ] `.docx` and PDF export for `ats-resume`, or a documented handoff to an existing JSON Resume theme
- [ ] A `--fix` mode for the mechanical half of `plainspoken`
- [ ] More `pagecheck` viewports, and a stored baseline so a regression is visible as a diff

## 🤝 Contributing

Two rules, and they are the ones that matter:

1. **A new rule ships with both halves.** It must fire on input built to trip it *and* stay silent on real known-good work. Add fixtures for each.
2. **Never weaken a gate to make something pass.** A red check means something broke. Fix the input.

Beyond that: run `npm test`, run `npm run lint:prose`, and say in the pull request what you ran and what you could not verify.

Every rule carries a comment explaining why it survived. If you add one, say what it caught and what it was tested against. A rule with no recorded reason gets deleted by the next person, or kept without anyone knowing why.

## 🙏 Credits

`plainspoken`'s AI-fingerprint rules build on [ARPeeketi/claude-resume-kit](https://github.com/ARPeeketi/claude-resume-kit). Seven prose patterns are distilled from the `deslop` skill in [every-app/open-seo](https://github.com/every-app/open-seo): the seven that survived the false-positive filter above.

Curated third-party work belongs to its authors: [pbakaus/impeccable](https://github.com/pbakaus/impeccable), [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill), [emilkowalski/skills](https://github.com/emilkowalski/skills), [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo), [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman), [yvgude/lean-ctx](https://github.com/yvgude/lean-ctx).

## 📄 License

[MIT](./LICENSE) © [Alok Rajasukumaran](https://alokraj68.in)
