---
name: plain-writing
description: Write prose that does not read as machine-written. Use when drafting or editing any prose a human will read - documentation, READMEs, release notes, landing copy, resumes, blog posts, commit messages - or when asked to remove AI slop, de-slop, or make writing sound human.
---

# Plain writing

The linter catches phrases. This catches the thinking behind them.

Run `npx @alokraj68/plainspoken <path>` for the mechanical half. Everything below is the
half a regex cannot do.

## The one rule underneath all the others

**Detectors flag abstraction, not vocabulary.**

That is the whole thing. A sentence that names a system, a client, a tool, a
number or a date reads as human, because only someone who was there would know
it. Swapping "leverage" for "use" in a sentence that still says nothing has
improved nothing.

> Managed extensive cloud infrastructure across the organisation.

> Managed 80+ Azure servers and the team of interns who kept them patched.

The second is not better because the words are plainer. It is better because it
could only have been written by someone who did it.

So when a sentence trips the linter, the fix is almost never a synonym. Ask what
actually happened, and write that.

## Use the plain word

These are not a filter to slip past. They are the vocabulary to use instead.

| Not this | This |
|---|---|
| leverage, utilise, harness | use, apply, draw on |
| spearhead | lead, start, launch |
| robust | strong, reliable |
| comprehensive | thorough, broad |
| extensive | broad, deep, 10+ years of |
| facilitate | run, lead, coordinate |
| meticulous | careful, precise |
| foster | support, build, grow |
| showcase | show, demonstrate |
| delve into | dig into, examine |
| myriad, plethora | many |
| consequently, subsequently, moreover, furthermore | so, then, and |

A word on the list is sometimes correct. `Realm` is a mobile database before it
is a metaphor, and a report on land use may legitimately discuss a landscape.
That is what the `allow` config key is for. Reach for it rarely, and leave a
reason next to it.

## Structural tells

**The vague tail.** A sentence that trails into a participial clause instead of
landing on a result. "…enabling improved efficiency" is a fingerprint.
"…cutting the nightly export from 50 minutes to 11" is a fact. If a tail has no
number in it, it is usually decoration - delete it or replace it with what
happened.

<!-- plainspoken-disable-next-line: quoting the patterns this section is about -->
**Paired generic adjectives.** "scalable, secure platforms" tells a reader
nothing they would not have assumed. Name the platform.

**The tool-list ending.** "…built using TDD, DDD and microservices on Azure
pipelines." The tools belong in the sentence, just not as the payoff. End on the
outcome.

**Flat rhythm.** Three sentences of near-identical length in a row reads as
generated even when each one is fine. Vary the length. A short one lands.

<!-- plainspoken-disable-next-line: quoting the patterns this section is about -->
**Throat-clearing.** "Here's the thing", "It's worth noting that", "The truth
is". Cut the opener; start at the noun.

## Cadence

- Vary how sentences open. Three list items starting on the same verb reads as a template.
- Two em-dashes per document is plenty. More than that is a tic.
- Active voice by default. Passive is a choice for when the actor genuinely does not matter.
- One idea per sentence. If it needs a semicolon to survive, it is two sentences.

## Editing someone else's draft

Change the wording, never the facts. If a sentence is vague because the writer
did not have a number, do not invent one - flag it and ask. A confident sentence
built on a fabricated metric is worse than a vague honest one, and it is the
failure mode that ends careers rather than paragraphs.

When you cannot verify a claim, say so plainly in your response rather than
quietly softening it into something unfalsifiable.

## Checking your work

```
npx @alokraj68/plainspoken docs/                 # docs preset, the default
npx @alokraj68/plainspoken cv.md --preset resume # ratios become gates
npx @alokraj68/plainspoken . --warnings-as-errors
```

Errors are fixed phrases with no defensible use. Warnings are heuristics -
ratios and rhythm - and are advice, not verdicts. If a warning is wrong for your
document, suppress that line and write down why:

```markdown
<!-- plainspoken-disable-next-line -->
Banned words include "responsible for" and "team player".
```

A suppression with a reason is documentation. A suppression without one is a
checker being switched off.

## Related skills

Part of [craftkit](https://github.com/alokraj68/craftkit). Reach for these when
the task moves outside this one:

| Skill | Tool | For |
|---|---|---|
| [`page-audit`](https://github.com/alokraj68/craftkit/tree/main/plugins/pagecheck/skills/page-audit) | `npx @alokraj68/pagecheck` | layout and typography: overflow, tiny text, tap targets, contrast |
| [`tailor-resume`](https://github.com/alokraj68/craftkit/tree/main/plugins/ats-resume/skills/tailor-resume) | `npx @alokraj68/ats-resume` | résumé parseability and job-description matching |
| [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup/skills/craft-setup) | skill only | the working agreement: verify before claiming done |

Install any of them, or all four, with `npx @alokraj68/craftkit`.
