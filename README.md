# craftkit

Quality gates for shipping work, as Claude Code plugins. Plus a curated list of
the third-party skills they grew up alongside — by reference, never copied.

```
/plugin marketplace add alokraj68/craftkit
```

Then install only what you want:

```
/plugin install craft-setup@craftkit
/plugin install plainspoken@craftkit
/plugin install pagecheck@craftkit
/plugin install ats-resume@craftkit
```

## Four plugins

### `craft-setup` — the working agreement

Skill only, no code. What an agent should do before it says a thing is done:
run the typecheck, run the linter on every file it touched, run the build once,
and **name what it could not verify** instead of implying it did. Never commit
without being asked in that message. Enforce rules in code, not in a checklist
someone is trusted to follow.

Distilled from running agents across a résumé generator, an Angular ERP, a
NestJS backend and several Flutter apps.

### `plainspoken` — prose that does not read as machine-written

A linter with zero dependencies. Reads Markdown and text, so it works on docs,
READMEs, release notes, landing copy and CVs alike.

```
npx plainspoken docs/
```

```
docs/architecture.md
  error   14  ai-phrase        "proven track record" has no defensible use
  error   31  vague-tail       trails off into a vague clause instead of landing on a result
        Built the reporting layer, enabling improved efficiency
  warn    22  ai-word          "leverage" - try: use, apply, draw on
```

Errors are fixed phrases with no defensible use. Warnings are heuristics.
`--preset resume` promotes the ratios to gates.

### `pagecheck` — pages that survive a phone

Renders every page at phone and desktop widths and reports what a desktop
review never sees.

```
npx pagecheck ./dist
npx pagecheck https://example.com
```

Horizontal overflow **and the element causing it**, ragged line endings, text
under 12px, tap targets under 44px, plus size, leading, weight, measure and
WCAG AA contrast per text style. Playwright is a peer dependency.

### `ats-resume` — a résumé a machine can read

Different question from `plainspoken`: not whether the prose reads well, but
whether an applicant tracking system can parse the file at all.

```
npx ats-resume lint resume.json
npx ats-resume tailor resume.json posting.txt
```

Built on the [JSON Resume](https://jsonresume.org) schema. Catches promotion
chains in the title field, non-ISO dates, glyphs a parser chokes on, and the
contact block losing its separators during PDF extraction — which looks perfect
in the DOM and leaves one unsplittable string in the file.

## Why these and not the dozens that already exist

**A checker that fires on correct work is worse than no checker.** It trains
everyone to ignore it, and then it catches nothing at all.

That is not a slogan here, it is the filter every rule had to pass. A published
~980-line de-slop catalogue, run against real technical writing, produced nine
hits and eight were false positives — it read "ported from Java to C#" as a
false range and "Australia, Europe and the US" as tricolon abuse. Both are just
facts. Seven patterns survived. Those seven shipped; the rest did not.

`pagecheck` has the same history. Three classes of false positive had to be
eliminated before its numbers meant anything: `getClientRects()` returns one
rect per inline-block box rather than one per rendered line, scroll animations
leave elements mid-transform, and stacked block children are separate lines by
design rather than badly wrapped prose.

Every test suite asserts twice — a rule must fire on input built to trip it
**and** stay silent on input that is merely factual. 91 tests.

## The curated toolkit

`toolkit/skills.json` lists the Claude Code skills and plugins this grew out of.

```
node toolkit/install.mjs --list      # see everything
node toolkit/install.mjs             # pick what you want
node toolkit/install.mjs animate karpathy-guidelines
```

Nothing third-party is vendored here. Of the 47 skills this was drawn from, 26
carry **no licence file**, which under copyright means the author kept every
right — public is not the same as redistributable. The installer clones from
each upstream instead, so their name stays on the work and their fixes reach
you. Check each licence yourself before relying on one commercially.

It installs skills under their **declared** name rather than their directory
name, which is a real difference for at least one of them, and it never installs
anything without an explicit choice and a confirmation prompt. These run with
full agent permissions.

## Credits

`plainspoken`'s AI-fingerprint rules build on
[ARPeeketi/claude-resume-kit](https://github.com/ARPeeketi/claude-resume-kit).
Seven prose patterns are distilled from the `deslop` skill in
[every-app/open-seo](https://github.com/every-app/open-seo) — the seven that
survived the false-positive filter above.

Curated third-party work belongs to its authors:
[pbakaus/impeccable](https://github.com/pbakaus/impeccable),
[leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill),
[emilkowalski/skills](https://github.com/emilkowalski/skills),
[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills),
[AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo),
[nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail),
[JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman),
[yvgude/lean-ctx](https://github.com/yvgude/lean-ctx).

## Licence

MIT, for the code in this repository.
