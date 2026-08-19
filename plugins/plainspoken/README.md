# plainspoken

Fail the build when writing reads as machine-written.

A prose linter with no dependencies, plus the judgement half as a Claude Code
skill. It reads Markdown and plain text, not a schema, so it works on docs,
READMEs, release notes, landing copy and CVs alike.

```
npx @alokraj68/plainspoken docs/
```

```
docs/architecture.md
  error   14  ai-phrase        "proven track record" has no defensible use
        We have a proven track record and are well-versed in scalable systems.
  error   14  adjective-pair   "scalable, secure" - two generic adjectives in a row
  error   31  vague-tail       trails off into a vague clause instead of landing on a result
        Built the reporting layer, enabling improved efficiency
  warn    22  ai-word          "leverage" - try: use, apply, draw on

1 file(s): 3 error(s), 1 warning(s)
```

## Why another one

Most tools in this space fall into two camps. Word-list checkers flag
"leverage" and call it a day, which teaches you to write "utilise" instead.
Essay-tuned catalogues flag everything, including facts.

That second failure is the interesting one. A ~980-line published de-slop rule
set, run against a real corpus of technical writing, produced nine hits and
eight were false positives. It read "ported from Java to C#" as a false range
and "Australia, Europe and the US" as tricolon abuse. Both are just true things.

**A checker that fires on facts trains you to ignore it, which is worse than no
checker.** So the rules here were filtered the other way round: a pattern only
ships if it fires on writing built to trip it *and* stays silent on writing
that is merely factual. Both halves are asserted in the test suite.

Three of the rules come from sentences a real AI detector flagged, and were
turned into checks rather than notes.

## The thing underneath

Detectors flag **abstraction**, not vocabulary.

> Managed extensive cloud infrastructure across the organisation.

> Managed 80+ Azure servers and the team of interns who kept them patched.

The second is not better because the words are plainer. It is better because
only someone who was there could have written it. When a sentence trips a rule,
the fix is almost never a synonym.

## Rules

Errors are fixed phrases with no defensible use. Warnings are heuristics, and
heuristics make bad gates.

| Rule | Severity | Catches |
|---|---|---|
| `ai-phrase` | error | "proven track record", "well-versed in", "at the forefront of" |
| `filler-phrase` | error | "responsible for", "team player", "improved performance" with no number |
| `prose-tell` | error | throat-clearing, "serves as a", "imagine a world", stakes inflation |
| `adjective-pair` | error | "scalable, secure platforms" |
| `tech-list-tail` | error | sentences ending on a tool list instead of a result |
| `vague-tail` | error | "…, enabling improved efficiency" (a tail with a number is fine) |
| `abstraction` | warn | share of sentences naming no number and no proper noun |
| `passive-voice` | warn | share of sentences in passive voice |
| `ai-word` | warn | delve, harness, spearhead, cornerstone — with the plain word to use |
| `flat-rhythm` | warn | three sentences of near-identical length in a row |
| `repeated-opener` | warn | three list items opening on the same word |
| `em-dash` | warn | more than two per document |
| `filler-adjective` | warn | robust, seamless, world-class, mission-critical |

Code fences, inline code, frontmatter, URLs, link targets, HTML tags and tables
are never linted, and line numbers still point at the original file.

## Presets

```
npx @alokraj68/plainspoken docs/                    # docs (default) - ratios advise
npx @alokraj68/plainspoken cv.md --preset resume    # ratios become gates
npx @alokraj68/plainspoken . --preset strict        # everything fails
```

`docs` is deliberately forgiving: a short, factual README legitimately trips
`abstraction`, and failing a build over that is how a linter gets deleted.

## Config

`plainspoken.config.json`, or `--config <path>`:

```json
{
  "preset": "docs",
  "maxEmDashesPerDoc": 2,
  "maxPassiveRatio": 0.25,
  "maxAbstractRatio": 0.5,
  "warnOnAiWords": true,
  "allow": ["realm"],
  "severity": { "flat-rhythm": "off" }
}
```

`allow` exists for words that are legitimate in your domain. Realm is a mobile
database before it is a metaphor. Use it rarely, and leave a reason beside it.

## Suppression

A document about banned phrases has to be able to quote them:

```markdown
<!-- plainspoken-disable-next-line -->
Banned wording includes "responsible for" and "team player".

<!-- plainspoken-disable -->
...quoted slop...
<!-- plainspoken-enable -->
```

A suppression with a reason is documentation. One without is a checker being
switched off.

## As a Claude Code plugin

The linter catches phrases. The skill catches the thinking behind them — the
plain-word table, the structural tells, and the rule that you change wording and
never facts.

```
/plugin marketplace add alokraj68/craftkit
/plugin install plainspoken@craftkit
```

## In CI

```yaml
- run: npx @alokraj68/plainspoken docs/ README.md
```

Exit code is 1 on any error, 0 otherwise. `--warnings-as-errors` tightens that,
and `--json` gives machine-readable output.

## As a library

```js
import { lint } from '@alokraj68/plainspoken';

const { findings, stats } = lint(markdown, { preset: 'resume' });
```


## Credits

The AI-fingerprint rules build on
[ARPeeketi/claude-resume-kit](https://github.com/ARPeeketi/claude-resume-kit).
Seven prose patterns are distilled from the `deslop` skill in
[every-app/open-seo](https://github.com/every-app/open-seo) — the seven that
survived the false-positive filter described above. The rest of that catalogue
is deliberately not imported.

## 🧰 Part of craftkit

One of four tools in [craftkit](https://github.com/alokraj68/craftkit). Set all of
them up at once, picking only what you need:

```bash
npx @alokraj68/craftkit
```

| | | |
|---|---|---|
| ✍️ **`plainspoken`** | you are here | prose that does not read as machine-written |
| 📱 [`pagecheck`](https://www.npmjs.com/package/@alokraj68/pagecheck) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/pagecheck) | pages that survive a phone: overflow, tiny text, tap targets, WCAG AA |
| 📄 [`ats-resume`](https://www.npmjs.com/package/@alokraj68/ats-resume) | [docs](https://github.com/alokraj68/craftkit/tree/main/plugins/ats-resume) | a résumé an applicant tracking system can parse, and JD gap analysis |
| 🧭 [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup) | skill only | verify before claiming done; never commit unasked |

### The skill ships with this package

`skills/plain-writing/SKILL.md` is the judgement half: the calls a linter cannot make. It installs
as a Claude Code skill via the marketplace, and it is also in the npm tarball at
`node_modules/@alokraj68/plainspoken/skills/plain-writing/SKILL.md`, so an agent can read it without the marketplace.

```
/plugin marketplace add alokraj68/craftkit
/plugin install plainspoken@craftkit
```

## Licence

MIT
