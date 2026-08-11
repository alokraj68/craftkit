import {
  STANDARD_HEADINGS, NONSTANDARD_HEADINGS, BAD_GLYPHS, EXPANSIONS,
  EXEC_SIGNALS, BAD_FILENAMES, DEFAULTS, STOPWORDS,
} from './rules.mjs';
import { normalize, ISO_DATE, terms, mentions } from './normalize.mjs';

const finding = (severity, rule, message, evidence = null) =>
  ({ severity, rule, message, evidence });

/**
 * Check a JSON Resume for the things that stop a machine reading it.
 *
 * This is the source-level pass. It catches defects more cheaply than rendering
 * would - a dash in a job title, a promotion chain in the position field - but
 * it cannot see what survives PDF extraction. For that, run `lintExtracted`
 * against the text pulled out of the built file. Both matter, and the second
 * one is the one that finds the surprises.
 */
export function lintResume(resume, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const r = normalize(resume);
  const out = [];

  // ---- contact ----
  if (!r.contact.name) out.push(finding('error', 'contact', 'basics.name is missing'));
  if (!r.contact.email) out.push(finding('error', 'contact', 'basics.email is missing - a parser has nothing to key on'));
  if (!r.contact.phone) out.push(finding('warn', 'contact', 'basics.phone is missing'));
  if (!r.contact.location) out.push(finding('warn', 'contact', 'basics.location is empty - many filters key on city or country'));
  // A location field holding several cities parses as one nonsense string.
  if ((r.contact.location.match(/,/g) ?? []).length > 3) {
    out.push(finding('warn', 'contact', 'location lists too many places; keep one primary and put the rest in prose', r.contact.location));
  }

  // ---- sections a parser buckets by ----
  if (!r.sections.work) out.push(finding('error', 'sections', 'no work history'));
  if (!r.sections.education) out.push(finding('warn', 'sections', 'no education section - some ATS treat it as a required field'));
  if (!r.sections.skills) out.push(finding('warn', 'sections', 'no skills section - this is where literal keyword matching happens'));

  // ---- roles ----
  let currentCount = 0;
  for (const role of r.roles) {
    const where = `${role.position || '?'} at ${role.company || '?'}`;
    if (!role.company) out.push(finding('error', 'role', 'a work entry has no company name'));
    if (!role.position) out.push(finding('error', 'role', `no position title (${role.company})`));

    // A promotion chain in the title field parses as one garbled job.
    if (/[→>]|\s+to\s+.*\bdeveloper\b/i.test(role.position)) {
      out.push(finding('error', 'title-chain',
        `"${role.position}" reads as one garbled title. Use the final title; put the climb in the summary`, where));
    }
    // Em and en dashes break field extraction wherever they appear.
    if (/[—–]/.test(role.position) || /[—–]/.test(role.company)) {
      out.push(finding('error', 'dash', `em/en dash in a parsed field - use a plain hyphen`, where));
    }
    for (const [label, value] of [['startDate', role.start], ['endDate', role.end]]) {
      if (value && !ISO_DATE.test(value)) {
        out.push(finding('error', 'date-format',
          `${label} "${value}" is not ISO (YYYY-MM). Date extraction is the most fragile part of parsing`, where));
      }
    }
    if (!role.start) out.push(finding('error', 'date-format', `no startDate (${where})`));
    if (role.current) currentCount++;
    if (!role.highlights.length && !role.summary) {
      out.push(finding('warn', 'role', `no highlights or summary (${where})`));
    }
  }
  if (currentCount > 1) {
    out.push(finding('warn', 'concurrent-roles',
      `${currentCount} roles have no endDate. Some ATS sum ranges and compute inflated tenure - be ready to explain it`));
  }

  // ---- glyphs ----
  const allText = [...r.prose.map(([, v]) => v), ...r.skills].join('\n');
  const glyphs = BAD_GLYPHS.filter((g) => allText.includes(g));
  if (glyphs.length) {
    out.push(finding('error', 'glyphs', `decorative glyphs in body text: ${glyphs.join(' ')}. Use a plain hyphen`));
  }

  // ---- headings people invent ----
  for (const h of NONSTANDARD_HEADINGS) {
    if (mentions(allText, h)) {
      out.push(finding('warn', 'heading', `"${h}" is not a heading an ATS recognises`, h));
    }
  }

  // ---- acronyms, both forms ----
  const absent = EXPANSIONS.filter(([short, long]) =>
    mentions(allText, short) && !mentions(allText, long));
  if (absent.length > cfg.maxMissingExpansions) {
    out.push(finding('warn', 'acronyms',
      `${absent.length} acronyms appear without their expansion: ${absent.map(([s]) => s).join(', ')}. A posting spelling it out scores zero against you`));
  }

  // ---- quantification ----
  if (r.highlights.length) {
    const quantified = r.highlights.filter((h) => /\d/.test(h.text)).length;
    const ratio = quantified / r.highlights.length;
    if (ratio < cfg.minQuantifiedRatio) {
      out.push(finding('warn', 'quantified',
        `${quantified}/${r.highlights.length} highlights carry a number (${Math.round(ratio * 100)}%, target ${Math.round(cfg.minQuantifiedRatio * 100)}%)`));
    }
  }

  // ---- executive signals ----
  const missing = EXEC_SIGNALS.filter(([, re]) => !re.test(allText));
  for (const [name, , question] of missing) {
    out.push(finding('info', 'exec-signal', `${name}: ${question}`));
  }

  return { findings: out, normalized: r };
}

/**
 * Check the text an ATS actually receives.
 *
 * Source-level checks cannot see this. Standalone separator elements looked
 * correct in the HTML, rendered correctly on screen, and were silently dropped
 * from the PDF text layer - only reading the extracted text found it.
 */
export function lintExtracted(text, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const out = [];

  if (text.length < cfg.minTextLength) {
    out.push(finding('error', 'text-layer',
      `only ${text.length} characters extracted. An image-only PDF scores zero with every ATS`));
  }

  const found = STANDARD_HEADINGS.filter((h) => new RegExp(`^\\s*${h}\\b`, 'im').test(text));
  if (!found.length) {
    out.push(finding('error', 'headings', 'no standard section heading found in the extracted text'));
  } else {
    for (const need of ['Experience', 'Skills', 'Education']) {
      const ok = found.some((h) => h.toLowerCase().includes(need.toLowerCase()));
      if (!ok) out.push(finding('warn', 'headings', `no "${need}" heading survived extraction`));
    }
  }

  // Flex gaps do not exist in extracted text. Without an explicit separator
  // inside each field's own text node, the contact line fuses into one
  // unsplittable string.
  const head = text.split('\n').slice(0, 6).join('\n');
  const seps = (head.match(/[|·•]/g) ?? []).length;
  if (seps < cfg.minSeparators) {
    out.push(finding('error', 'contact-separators',
      `contact block has ${seps} explicit separator(s). Fields will fuse into one string on extraction`, head.split('\n')[0]));
  }

  const emDashDates = text.match(/\b(19|20)\d{2}\s*[—–]\s*((19|20)\d{2}\b|Present)/g) ?? [];
  if (emDashDates.length) {
    out.push(finding('error', 'dash', `${emDashDates.length} date range(s) use an em/en dash`, emDashDates[0]));
  }

  const glyphs = BAD_GLYPHS.filter((g) => text.includes(g));
  if (glyphs.length) out.push(finding('error', 'glyphs', `decorative glyphs survived into the text layer: ${glyphs.join(' ')}`));

  // Keyword stuffing, measured as density. A standard-deviation test is
  // meaningless on a 700-word document: almost any word appearing ten times is
  // an outlier, which made an earlier version fire on "engineering" and a
  // country name. Real stuffing sits at 2.5%+ for a single term.
  const words = terms(text);
  const freq = new Map();
  for (const w of words) if (!STOPWORDS.has(w) && w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
  const stuffed = [...freq.entries()]
    .filter(([, n]) => n >= 6 && n / words.length >= cfg.maxKeywordDensity)
    .sort((a, b) => b[1] - a[1]);
  if (stuffed.length) {
    out.push(finding('warn', 'stuffing',
      `keyword density above ${(cfg.maxKeywordDensity * 100).toFixed(1)}%: ${stuffed.slice(0, 4).map(([w, n]) => `${w} ${n}x`).join(', ')}`));
  }

  return { findings: out, words: words.length };
}

/** `FirstName-LastName-Resume.pdf`, never `resume_final_v3.docx`. */
export function lintFilename(filename, name = '') {
  const out = [];
  const base = filename.split('/').pop();
  for (const re of BAD_FILENAMES) {
    if (re.test(base)) {
      out.push(finding('warn', 'filename',
        `"${base}" - use FirstName-LastName-Resume.pdf so it is identifiable in an inbox`));
      break;
    }
  }
  if (name && !mentions(base.replace(/[-_]/g, ' '), name.split(/\s+/)[0])) {
    out.push(finding('warn', 'filename', `"${base}" does not contain your name`));
  }
  return out;
}

/**
 * Match a résumé against a job description.
 *
 * Deliberately literal, because ATS matching is. The gap list matters more than
 * the score: it is the interview preparation list, and a missing term has
 * exactly three honest outcomes - true and unwritten, true but weak, or not
 * true. Only the first is a wording fix.
 */
export function tailor(resume, jobDescription, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const r = normalize(resume);
  const haystack = [...r.prose.map(([, v]) => v), ...r.skills, ...r.roles.map((x) => `${x.position} ${x.company}`)].join('\n');

  // A term that appears capitalised somewhere other than the start of a
  // sentence is almost always a technology or a company - Terraform, Datadog,
  // Postgres. Words like "heavily" and "expected" never are. Without this the
  // gap list fills with job-ad boilerplate, and a gap list nobody reads is
  // worth nothing.
  const proper = new Set();
  for (const m of jobDescription.matchAll(/(\S)\s+([A-Z][A-Za-z0-9+#.-]{1,})/g)) {
    if (!/[.!?:;]/.test(m[1])) proper.add(m[2].toLowerCase().replace(/[.,]+$/, ''));
  }

  const counts = new Map();
  for (const w of terms(jobDescription)) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  // Keep the named things. If the posting names nothing (rare, and usually a
  // badly written ad), fall back to raw frequency rather than reporting nothing.
  if ([...counts.keys()].some((w) => proper.has(w))) {
    for (const w of [...counts.keys()]) if (!proper.has(w)) counts.delete(w);
  }
  // Rank by how often the posting repeats a term: repetition is the clearest
  // signal of what it actually screens on.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);

  const covered = [];
  const missing = [];
  for (const [term, n] of ranked) {
    (mentions(haystack, term) ? covered : missing).push({ term, count: n });
  }

  const rate = ranked.length ? covered.length / ranked.length : 0;
  const fatal = missing.filter((m) => m.count >= cfg.fatalGapRepeats);

  return {
    matchRate: rate,
    verdict: rate >= cfg.matchRatePass ? 'pass'
      : rate >= cfg.matchRateMarginal ? 'marginal' : 'likely-filtered',
    covered,
    missing,
    fatalGaps: fatal,
    // Which of your roles to lead with, by how much JD vocabulary they carry.
    leadWith: r.roles
      .map((role) => ({
        role: `${role.position}, ${role.company}`,
        hits: ranked.filter(([t]) => mentions(`${role.summary} ${role.highlights.join(' ')}`, t)).length,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3),
  };
}

/** Page count straight from the PDF object headers - no parser dependency. */
export function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
