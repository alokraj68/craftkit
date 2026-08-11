// What an applicant tracking system actually does to a résumé.
//
// These are old, literal programs. They split on plain separators, want
// hyphenated date ranges, and choke on decorative glyphs and multi-column
// layouts. Nothing here is about whether the writing is good - that is
// `plainspoken`'s job, and the two are deliberately separate. This file is only
// about whether a machine can read the file at all, and whether it matches the
// posting.

/** Section headings ATS parsers recognise and bucket content by. */
export const STANDARD_HEADINGS = [
  'Summary', 'Experience', 'Work Experience', 'Employment',
  'Skills', 'Projects', 'Education', 'Certifications',
];

/** Headings that look better to a human and parse as nothing. */
export const NONSTANDARD_HEADINGS = [
  'My Journey', 'What I Have Done', "What I've Done", 'Core Competencies',
  'Core Skills', 'Professional Journey', 'About Me', 'Career Highlights',
  'Where I Have Worked', 'My Story',
];

/** Glyphs that survive into the text layer and confuse parsers. */
export const BAD_GLYPHS = ['→', '←', '↔', '✓', '✔', '★', '✦', '●', '▪', '»'];

/**
 * Acronyms an ATS treats as strings, not concepts. A posting asking for
 * "Natural Language Processing" scores zero against a résumé that only says
 * "NLP", and vice versa. Both forms have to be literally present somewhere.
 */
export const EXPANSIONS = [
  ['AI', 'Artificial Intelligence'],
  ['ML', 'Machine Learning'],
  ['NLP', 'Natural Language Processing'],
  ['LLM', 'Large Language Models'],
  ['RAG', 'Retrieval-Augmented Generation'],
  ['API', 'Application Programming Interface'],
  ['REST', 'Representational State Transfer'],
  ['CI/CD', 'Continuous Integration and Continuous Delivery'],
  ['SaaS', 'Software as a Service'],
  ['IoT', 'Internet of Things'],
  ['TDD', 'Test-Driven Development'],
  ['DDD', 'Domain-Driven Design'],
  ['UX', 'User Experience'],
  ['UI', 'User Interface'],
  ['ERP', 'Enterprise Resource Planning'],
  ['POS', 'Point of Sale'],
  ['CRM', 'Customer Relationship Management'],
  ['QA', 'Quality Assurance'],
  ['SEO', 'Search Engine Optimization'],
  ['K8s', 'Kubernetes'],
];

/**
 * Signals a hiring manager looks for at leadership level. Absent is not a
 * defect - it is a question you will be asked with nothing prepared.
 *
 * The patterns match the verb form as well as the noun: "retained most of the
 * founding team" states retention without ever using the word.
 */
export const EXEC_SIGNALS = [
  ['team size', /\b(\d+\+?\s*(engineers|developers|people|reports|staff)|team of \d+)/i,
    'How many people, at peak and at once?'],
  ['hiring', /\b(hired|recruit\w*|onboard\w*|talent)\b/i,
    'How many did you hire, and over what period?'],
  ['retention', /\b(retention|retained|attrition|churn|still (in place|here|with)|average tenure)\b/i,
    'Did people stay? A defensible proxy counts.'],
  ['budget', /\b(budget|\$[\d.]+\s*[mkb]\b|cost|p&l|spend|savings?)\b/i,
    'What did you own or save, in money?'],
  ['revenue', /\b(revenue|arr|mrr|gmv|bookings|turnover)\b/i,
    'What business outcome did your work carry?'],
  ['scale', /\b(\d[\d,]*\+?\s*(users|customers|requests|transactions|records|visitors)|uptime|sla|\d+\.?\d*%)/i,
    'How big was the thing you ran?'],
  ['delivery speed', /\b(time to market|lead time|deployment frequency|release cadence|faster|weekly|daily)\b/i,
    'Did delivery get faster under you? From what to what?'],
  ['strategy', /\b(strateg\w+|roadmap|architecture|vision|governance)\b/i,
    'What did you decide, not just build?'],
];

/** Filename conventions. `resume.pdf` is indistinguishable in a recruiter's inbox. */
export const BAD_FILENAMES = [
  /^resume\.(pdf|docx?|txt)$/i,
  /^cv\.(pdf|docx?|txt)$/i,
  /final|_v\d|version\s*\d|copy|draft|new|latest|updated/i,
];

export const DEFAULTS = {
  minTextLength: 800,       // below this the PDF has no usable text layer
  minSeparators: 3,         // in the contact block, after extraction
  maxKeywordDensity: 0.025, // real stuffing, not just a frequent subject word
  minQuantifiedRatio: 0.4,  // share of highlights carrying a number
  maxMissingExpansions: 3,
  matchRatePass: 0.7,       // >= 70% of JD terms covered
  matchRateMarginal: 0.6,
  fatalGapRepeats: 3,       // a term repeated this often in the JD, absent here
};

/** Words too common to count as job-description keywords. */
export const STOPWORDS = new Set(`a an the and or but if then than that this these those of in on at to for with from by as is are was were be been being have has had do does did will would shall should can could may might must not no yes you your we our they their it its he she his her them us me my i who whom whose which what when where why how all any both each few more most other some such only own same so too very just about into over under again further once here there when why how out up down off above below between through during before after
you will your role about us we are looking join team company work role position candidate ideal responsibilities requirements qualifications experience years strong good great excellent ability skills knowledge understanding working plus bonus nice preferred required must apply benefits salary equity remote hybrid onsite office full time part contract`.split(/\s+/));
