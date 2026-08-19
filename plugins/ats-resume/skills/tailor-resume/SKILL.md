---
name: tailor-resume
description: Tailor a resume to a specific job posting, or review one for whether an applicant tracking system can parse it. Use when adapting a CV to a role, analysing a job description, deciding which experience to lead with, or diagnosing why applications get auto-rejected.
---

# Tailoring a résumé

`ats-resume` does the mechanical half — parseability, keyword coverage, gaps.
This is the half it cannot do.

```
ats-resume lint resume.json
ats-resume tailor resume.json posting.txt
```

## Start with the strategy, not the file

Most rejection is not a formatting problem, and fixing bullets will not touch
it. Before editing anything, check:

- **Work authorisation.** Applying to a country where you need sponsorship,
  without saying so, is a knockout question no layout fixes. Say it explicitly
  and early if it is favourable.
- **One file for many bands.** A CTO screen and a Principal Engineer screen
  want opposite things. The executive framing reads as overqualified to an IC
  panel; the systems detail reads as not-executive to a board. Pick the band,
  then tailor inside it.
- **Volume without targeting.** A generic file sent to forty postings gets
  forty rejections. Ten tailored applications beat a hundred generic ones.

If someone is getting auto-rejected everywhere, look here first. It is usually
one of these three, not the résumé.

## The five readers

A résumé is read five times, each time differently. It has to survive all five.

1. **The ATS, in 0 seconds.** Can it extract the text, find the headings, split
   the contact block, and parse the dates? Machine-checked by `ats-resume lint`.
2. **A recruiter, in 10 seconds.** Title, current company, years, location. If
   those four are not visible without scrolling, nothing else matters.
3. **HR, in 30 seconds.** Do the dates line up, are there gaps, does the
   seniority claimed match the history?
4. **The hiring manager, in 2 minutes.** Has this person solved my problem
   before? This is what the top third of page one is for.
5. **A technical peer, in detail.** Would I want to work with whoever built
   this? Vague claims lose here, specifics win.

Optimising for one reader at the cost of another is the usual failure. Keyword
stuffing satisfies reader 1 and insults readers 4 and 5.

## Reading the gap list

The gap list matters more than the match rate. Every missing term has exactly
three honest outcomes:

- **True and unwritten** — add it to the bullet where the work actually
  happened. This is the only one that is a wording fix.
- **True but weak** — mention it once, plainly, with no metric attached.
- **Not true** — leave it out, and note it. That is your interview prep list.

**Never invent the third case into the first.** A fabricated tool on a CV
survives exactly until someone asks a follow-up question, and it costs the
role and the reference.

A fatal gap — a term in the posting's title, or repeated three or more times,
and absent from your history — is not fixable by rewording. It is information:
decide whether to apply at all.

## Where a keyword earns its place

Priority order, because position changes weight:

1. The summary and the first two bullets of the current role.
2. Other experience bullets.
3. The skills list.

A term that appears only in a bare skills list scores no higher with a parser
and lower with a human. Put it where the work happened.

**Match literally.** ATS compare strings, not concepts. A posting asking for
"Natural Language Processing" scores zero against a résumé that only says
"NLP". Carry both forms once.

## Writing the bullets

Structure: action verb → what was built → how → measurable result → scale.

- Concrete verbs: built, architected, shipped, reduced, automated, scaled.
- Vary the opening. Three bullets starting on the same verb reads as generated.
- No metric available? Use scale, speed, adoption or throughput. **Never invent
  a number.**
- Every bullet must survive: *could this person explain it in 30 seconds in an
  interview?*
- Every metric must survive: *would a hiring manager believe this at this
  level?*

For the wording itself — filler, AI tells, vague tails — use the
`plain-writing` skill. The rule that matters here: change the wording, never
the facts.

## Format

- Large company, or a Workday, Taleo or iCIMS uploader → `.docx`.
- Modern ATS, or emailing a human → `.pdf`.
- A paste-into-a-textarea field → plain text.
- If the posting names a format, that format wins.

Name the file `FirstName-LastName-Resume.pdf`. Never `resume.pdf`, never
`Final_v3`.

## Verify what you changed

Re-run `ats-resume lint` after editing, and read the extracted text rather than
trusting the source:

```
pdftotext -layout Sam-Rivera-Resume.pdf out.txt && ats-resume lint out.txt
```

Source and rendered output disagree more often than seems possible. Separator
characters that exist in the markup can vanish from a PDF's text layer, leaving
a contact line that no parser can split — and only reading the extraction finds
it.

## Related skills

Part of [craftkit](https://github.com/alokraj68/craftkit). Reach for these when
the task moves outside this one:

| Skill | Tool | For |
|---|---|---|
| [`plain-writing`](https://github.com/alokraj68/craftkit/tree/main/plugins/plainspoken/skills/plain-writing) | `npx @alokraj68/plainspoken` | prose that does not read as machine-written |
| [`page-audit`](https://github.com/alokraj68/craftkit/tree/main/plugins/pagecheck/skills/page-audit) | `npx @alokraj68/pagecheck` | layout and typography: overflow, tiny text, tap targets, contrast |
| [`craft-setup`](https://github.com/alokraj68/craftkit/tree/main/plugins/craft-setup/skills/craft-setup) | skill only | the working agreement: verify before claiming done |

Install any of them, or all four, with `npx @alokraj68/craftkit`.
