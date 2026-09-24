// Did a rewrite change a claim, or only its shape?
//
// Rewriting bullets is the most dangerous editing a résumé gets. Not because the
// prose degrades - a linter catches that - but because a figure can vanish in a
// reflow and BOTH versions stay individually valid. "Owned EDR, carrying over
// $50M in annual revenue, held at over 99.95% uptime" and "Owned EDR, held at
// high availability" are both well-formed sentences. Only one of them is the
// résumé you spent a year earning.
//
// So this compares two versions of the same document and reports what was in the
// old one and is in the new one nowhere at all. Reordering is invisible to it,
// which is the point: reordering is the safe half of a rewrite and flagging it
// would bury the unsafe half.
//
// It reads plain text, not the schema, because the question applies to whatever
// you have: two exports of a PDF, a JSON Resume before and after, a tailored
// copy against the master.

/**
 * A number, with its currency and unit attached.
 *
 * A comma counts only BETWEEN digits. Without that lookahead the pattern eats
 * trailing punctuation, so "acquired in 2026." reads as missing when the new
 * text says "its 2026 acquisition" - a false alarm on the most common edit
 * there is, which is exactly how a checker gets switched off.
 */
export const FIGURE = /\$?\d(?:\d|,(?=\d))*(?:\.\d+)?\s?[MKB]?%?/g;

/**
 * Capitalised runs: clients, employers, products, technologies.
 *
 * The inter-word space is `[^\S\n]`, not `\s`. A plain `\s` crosses line
 * breaks, so the last word of one skills row and the first of the next fuse
 * into "MS SQL\nCloud" - a name that was never on the page, reported as lost
 * from a page it was never on.
 *
 * Sentence-initial words are the other source of noise, handled in `names()`.
 */
export const NAME = /\b[A-Z][\w.&+-]*(?:[^\S\n]+[A-Z][\w.&+-]*)*\b/g;

const OPENERS = new Set([
  'The', 'A', 'An', 'It', 'I', 'And', 'But', 'This', 'That', 'These', 'Those',
  'In', 'On', 'At', 'For', 'From', 'To', 'With', 'By', 'Of', 'As', 'Not', 'No',
  'Also', 'Both', 'Every', 'Each', 'Over', 'Under', 'After', 'Before', 'When',
  'While', 'Where', 'They', 'We', 'He', 'She', 'His', 'Her', 'Their', 'Our',
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  // Résumé action verbs. A word list is usually the wrong answer, but this one
  // is closed by convention: every guide, this package's own skill included,
  // tells you to open a bullet on a past-tense action verb, so the set of words
  // that can appear there is small and known. The alternative was inferring it
  // from position, which drops "TEDx speaker" and "Clickastro reached" too.
  'Built', 'Led', 'Ran', 'Owned', 'Held', 'Cut', 'Set', 'Took', 'Moved', 'Made',
  'Hired', 'Grew', 'Shipped', 'Delivered', 'Closed', 'Presented', 'Worked',
  'Migrated', 'Rebuilt', 'Replaced', 'Architected', 'Designed', 'Developed',
  'Created', 'Launched', 'Drove', 'Managed', 'Directed', 'Founded', 'Scaled',
  'Reduced', 'Increased', 'Improved', 'Automated', 'Implemented', 'Introduced',
  'Established', 'Maintained', 'Extended', 'Rolled', 'Piloted', 'Prototyped',
  'Coached', 'Mentored', 'Negotiated', 'Raised', 'Secured', 'Achieved',
  'Streamlined', 'Consolidated', 'Standardised', 'Standardized', 'Refactored',
]);

/** Normalise a figure so "$3.5M" and "$3.5 M" are the same fact. */
const canon = (f) => f.replace(/\s+/g, '').toUpperCase();

export function figures(text) {
  return new Set((text.match(FIGURE) ?? []).map(canon));
}

/**
 * The first word of a bullet is a verb, by the convention every résumé guide
 * including this one insists on. So it is dropped before names are read, rather
 * than growing OPENERS a verb at a time - "Migrated", "Rebuilt", "Replaced" and
 * "Scrum-based" all reported as lost names on a real rewrite, and the next
 * rewrite would have found four more.
 */
const stripBulletVerbs = (text) => text
  .split('\n')
  .map((line) => line.replace(/^(\s*[-*•]\s+)\S+\s/, '$1'))
  .join('\n');

export function names(text) {
  const out = new Set();
  for (const raw of stripBulletVerbs(text).match(NAME) ?? []) {
    // A run that STARTS on a sentence opener is a verb plus whatever followed
    // it: "Owned EDR", "Led AI", "Ran Scrum-based". Drop the opener and keep
    // the rest, which is where the actual name is.
    const words = raw.split(/[^\S\n]+/);
    while (words.length && OPENERS.has(words[0])) words.shift();
    const n = words.join(' ');
    if (n.length < 3 || OPENERS.has(n)) continue;
    out.add(n);
  }
  return out;
}

/**
 * Facts in `before` that appear nowhere in `after`.
 *
 * @param {string} before  the version you trust
 * @param {string} after   the version you just wrote
 * @returns {{lostFigures: string[], lostNames: string[], words: {before: number, after: number}}}
 */
export function diffFacts(before, after) {
  const afterText = after;
  const lostFigures = [...figures(before)].filter((f) => !figures(afterText).has(f)).sort();

  // A name counts as lost only when the phrase AND every word in it is gone.
  //
  // Without the second half this fires on every honest rephrase: "the Google
  // Apigee API layer in front" becoming "an API layer in front (Google Apigee,
  // Azure Service Bus)" loses the exact phrase and not one fact. Reporting that
  // trains you to skim the output, and then the one that matters goes past too.
  const after_ = afterText;
  const lostNames = [...names(before)]
    // Split on hyphens too: "Scrum-based delivery" becoming "Scrum delivery"
    // keeps the fact and loses the compound.
    .filter((n) => !after_.includes(n)
      && !n.split(/[\s-]+/).some((w) => w.length > 2 && after_.includes(w)))
    .sort();

  return {
    lostFigures,
    lostNames,
    words: { before: before.split(/\s+/).filter(Boolean).length,
             after: afterText.split(/\s+/).filter(Boolean).length },
  };
}

/** Findings in the same shape the linters use, so one reporter prints them all. */
export function lintDiff(before, after) {
  const d = diffFacts(before, after);
  const out = [];
  for (const f of d.lostFigures) {
    out.push({ severity: 'error', rule: 'lost-figure',
      message: `"${f}" was in the previous version and is in this one nowhere`, evidence: null });
  }
  for (const n of d.lostNames) {
    out.push({ severity: 'warn', rule: 'lost-name',
      message: `"${n}" was in the previous version and is in this one nowhere`, evidence: null });
  }
  return { findings: out, ...d };
}
