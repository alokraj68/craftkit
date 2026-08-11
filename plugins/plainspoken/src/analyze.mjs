// Turning a document into the units the rules actually judge.
//
// Getting this right matters more than the rules do. A checker that lints code
// blocks, YAML frontmatter or URLs produces noise, and noise is how a checker
// gets switched off. Everything below exists to make sure a finding points at
// prose a human wrote.

/** Replace a span with blanks, so every later offset still maps to the source. */
const blank = (text, re) =>
  text.replace(re, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Strip everything that is not prose, preserving byte offsets and line breaks so
 * reported line numbers stay true to the original file.
 */
export function stripNonProse(raw) {
  let s = raw;
  // YAML / TOML frontmatter, but only at the very top of the file.
  s = s.replace(/^(---|\+\+\+)\n[\s\S]*?\n\1\n/, (m) => m.replace(/[^\n]/g, ' '));
  s = blank(s, /```[\s\S]*?```/g);      // fenced code
  s = blank(s, /~~~[\s\S]*?~~~/g);      // fenced code, tilde form
  s = blank(s, /(^|\n)( {4}|\t)[^\n]*/g); // indented code
  s = blank(s, /`[^`\n]*`/g);           // inline code
  s = blank(s, /<[^>\n]{1,200}>/g);     // html tags
  s = blank(s, /!?\[[^\]\n]*\]\([^)\n]*\)/g); // md links and images
  s = blank(s, /\bhttps?:\/\/\S+/g);    // bare urls
  s = blank(s, /^\s*\|.*\|\s*$/gm);     // md tables
  return s;
}

const ABBREV = /\b(?:e\.g|i\.e|etc|vs|approx|Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Co|St|No|Fig|Jr|Sr|Ph\.D|U\.S|U\.K)\.$/i;

/**
 * Split prose into sentences. Naive `split('.')` breaks on "Node.js", "e.g." and
 * "$4.5M", so a candidate boundary is rejected when the token before it is a
 * known abbreviation, a single capital (an initial), or a decimal number.
 */
export function sentences(text) {
  const out = [];
  const push = (from, to) => {
    const slice = text.slice(from, to);
    const lead = slice.length - slice.trimStart().length;
    const body = slice.trim();
    if (body) out.push({ text: body, offset: from + lead });
  };
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // A blank line ends a sentence. Without this a heading, a stripped code
    // block and the paragraph after it all fuse into one unit, and every
    // finding inside gets reported at the line the fused unit started on.
    if (c === '\n' && /^[ \t]*\n/.test(text.slice(i + 1))) {
      push(start, i);
      const m = text.slice(i).match(/^\s*/);
      start = i + m[0].length;
      i = start - 1;
      continue;
    }
    if (c !== '.' && c !== '!' && c !== '?') continue;
    const next = text[i + 1];
    // A boundary needs whitespace or end-of-text after it.
    if (next && !/\s/.test(next)) continue;
    const before = text.slice(start, i + 1);
    if (ABBREV.test(before.trimEnd())) continue;
    if (/\b[A-Z]\.$/.test(before.trimEnd())) continue;   // initials: "A."
    if (/\d\.$/.test(before.trimEnd()) && /^\s*\d/.test(text.slice(i + 1))) continue; // 4.5
    push(start, i + 1);
    start = i + 1;
  }
  push(start, text.length);
  return out;
}

/** Blank out list-item lines so bullets are not also counted as sentences. */
export const withoutBullets = (text) =>
  text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+.+$/gm, (m) => ' '.repeat(m.length));

/** Markdown list items, which are judged as units the way bullets are read. */
export function bullets(text) {
  const out = [];
  const re = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const body = m[1].trim();
    if (body) out.push({ text: body, offset: m.index + m[0].indexOf(body) });
  }
  return out;
}

/** 1-indexed line number for a character offset. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

export const words = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];

/**
 * Passive voice, approximated as "to be" + past participle. A full parser is not
 * worth the dependency here; this finds the constructions people actually write
 * and is deliberately conservative, since the rule is a ratio and a false
 * positive costs more than a miss.
 */
export function isPassive(sentence) {
  const m = sentence.match(
    /\b(is|are|was|were|be|been|being|am)\s+(\w+ly\s+)?(\w+(?:ed|en))\b(?!\s+(to|that)\b)/i,
  );
  if (!m) return false;
  // "is used by" is passive; "is interested in" is a state, not an action.
  const STATE = /^(interested|excited|pleased|based|located|involved|committed|dedicated|related|known|supposed|used)$/i;
  return !STATE.test(m[3]);
}

/** A sentence names something if it carries a number or a proper noun. */
export function isConcrete(sentence) {
  if (/\d/.test(sentence)) return true;
  // Skip the first word: sentence-initial capitals say nothing.
  const rest = sentence.replace(/^[^A-Za-z]*[A-Za-z][\w'-]*\s*/, '');
  return /\b[A-Z][\w.+#-]*\b/.test(rest);
}

/** Leading verb or first word, used to spot three bullets opening the same way. */
export const opener = (s) => (words(s)[0] ?? '').toLowerCase();
