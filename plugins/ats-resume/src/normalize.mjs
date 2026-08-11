// JSON Resume in, the units the checks care about out.
//
// The schema is jsonresume.org's - an existing open standard with a published
// JSON Schema and a theme ecosystem. Adopting it rather than inventing a shape
// means people bring a resume.json they may already have, instead of learning
// one more format that only this tool reads.
//
// Everything here is tolerant of missing sections. A résumé with no `awards` is
// normal, not an error, and half a résumé should still lint.

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Flatten a JSON Resume into:
 *   contact   the fields a parser must be able to split apart
 *   roles     work history, with dates normalised
 *   highlights every bullet, tagged with the role it belongs to
 *   prose     every free-text field, for the writing checks
 *   skills    flat list of every named skill or keyword
 */
export function normalize(resume) {
  const basics = resume?.basics ?? {};
  const location = basics.location ?? {};

  const roles = arr(resume.work).map((w) => ({
    company: str(w.name),
    position: str(w.position),
    location: str(w.location),
    start: str(w.startDate),
    end: str(w.endDate),
    // An absent endDate means current. Two of these is worth a warning: some
    // ATS sum date ranges and compute inflated total tenure.
    current: !str(w.endDate),
    summary: str(w.summary),
    highlights: arr(w.highlights).map(str).filter(Boolean),
  }));

  const highlights = roles.flatMap((r) =>
    r.highlights.map((text, i) => ({ text, role: r.company, index: i })),
  );

  const skills = [
    ...arr(resume.skills).flatMap((s) => [str(s.name), ...arr(s.keywords).map(str)]),
    ...arr(resume.projects).flatMap((p) => arr(p.keywords).map(str)),
  ].filter(Boolean);

  const prose = [
    ['basics.summary', str(basics.summary)],
    ['basics.label', str(basics.label)],
    ...roles.flatMap((r) => [
      [`work.summary:${r.company}`, r.summary],
      ...r.highlights.map((h, i) => [`work.highlight:${r.company}#${i + 1}`, h]),
    ]),
    ...arr(resume.projects).map((p) => [`project:${str(p.name)}`, str(p.description)]),
    ...arr(resume.education).map((e) => [`education:${str(e.institution)}`, str(e.area)]),
  ].filter(([, v]) => v);

  return {
    contact: {
      name: str(basics.name),
      email: str(basics.email),
      phone: str(basics.phone),
      url: str(basics.url),
      location: [str(location.city), str(location.region), str(location.countryCode)]
        .filter(Boolean).join(', '),
      profiles: arr(basics.profiles).map((p) => ({ network: str(p.network), url: str(p.url) })),
    },
    roles,
    highlights,
    skills: [...new Set(skills)],
    prose,
    sections: {
      work: roles.length,
      education: arr(resume.education).length,
      skills: arr(resume.skills).length,
      projects: arr(resume.projects).length,
      certificates: arr(resume.certificates).length,
    },
  };
}

/**
 * A date an ATS can parse. The schema asks for ISO (2016-04), and that is what
 * machines read most reliably; an em dash between two dates is the single most
 * common reason a range fails to extract.
 */
export const ISO_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** Render a range the way it should appear in the document. */
export const formatRange = (start, end) => `${start || '?'} - ${end || 'Present'}`;

/** Words from any text, lowercased, for keyword matching. */
export function terms(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#./-]{1,}/g) ?? [])
    .map((w) => w.replace(/[.]+$/, ''))
    .filter((w) => w.length > 1);
}

/**
 * Does the résumé contain this term as a literal string?
 *
 * ATS matching is literal, so this is intentionally not fuzzy. The one
 * concession is word-boundary matching, so "react" matches "React," but not
 * "reactive".
 */
export function mentions(haystack, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}
