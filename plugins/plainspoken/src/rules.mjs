// The rule set.
//
// Every rule here earned its place by firing on real writing and not firing on
// facts. That distinction is the whole design: a checker tuned for essays will
// flag "ported from Java to C#" as a false range and "Australia, Europe and the
// US" as tricolon abuse. Both are just true things. A checker that cries wolf on
// facts trains you to ignore it, which is worse than having no checker.
//
// severity: 'error' fails the run, 'warn' reports and passes.

/** Phrases with no defensible use. If one appears, the sentence was not written. */
export const AI_PHRASES = [
  /\bproven track record\b/i,
  /\bdemonstrated ability to\b/i,
  /\bstrong foundation in\b/i,
  /\bwell[- ]versed in\b/i,
  /\badept at\b/i,
  /\bin today's rapidly evolving\b/i,
  /\bat the forefront of\b/i,
  /\bthis experience has taught me\b/i,
  /\bi am uniquely positioned\b/i,
  /\bnavigate the complexities of\b/i,
  /\bunlock the (full )?potential\b/i,
  /\bin the ever[- ]changing (world|landscape)\b/i,
];

/**
 * Words that read as machine-generated. Warned, not failed: context decides.
 * "Realm" is a mobile database before it is a metaphor, and "landscape" is fine
 * when there is actual land.
 */
export const AI_WORDS = [
  'delve', 'tapestry', 'multifaceted', 'pivotal', 'synergy', 'paradigm', 'holistic',
  'nuanced', 'foster', 'embark', 'leverage', 'utilize', 'utilise', 'harness',
  'spearhead', 'cornerstone', 'cutting-edge', 'groundbreaking', 'robust',
  'comprehensive', 'meticulous', 'meticulously', 'notably', 'remarkably',
  'seamlessly', 'thereby', 'facilitate', 'showcase', 'underscore', 'bolster',
  'realm', 'testament', 'myriad', 'plethora', 'crucial', 'vital', 'elevate',
  // Formal connectors. Human writing reaches for "so", "then" and "and".
  'consequently', 'subsequently', 'additionally', 'moreover', 'furthermore',
];

/**
 * The strongest structural tell: a sentence that trails off into a participial
 * clause instead of landing on a result. "...enabling improved efficiency" is a
 * fingerprint. "...improving activation by 14%" is a fact, so a tail carrying a
 * number is allowed through.
 */
export const VAGUE_TAIL =
  /,\s+(enabling|improving|contributing|allowing|resulting in|driving|helping|ensuring|leading to|supporting|facilitating|empowering|streamlining|fostering|paving the way)\b[^0-9]*\.?$/i;

/**
 * Paired generic adjectives: "scalable, secure healthcare platforms". Carries no
 * information a reader could not assume, and models emit it constantly. Name the
 * system instead.
 */
const FILLER_ADJ_ALT =
  'scalable|secure|robust|reliable|efficient|modern|complex|critical|seamless|flexible|comprehensive|innovative|powerful|dynamic|high[- ]quality|business[- ]critical|cutting[- ]edge|state[- ]of[- ]the[- ]art';
export const ADJECTIVE_PAIR = new RegExp(
  `\\b(${FILLER_ADJ_ALT})\\b,?\\s+(and\\s+)?\\b(${FILLER_ADJ_ALT})\\b`, 'i',
);

/**
 * A sentence that ends on a tool list rather than a result:
 * "...models using TDD, DDD and microservices on Azure pipelines."
 * The tools belong in the sentence, just not as the payoff.
 */
export const TECH_LIST_TAIL =
  /\b(using|with|leveraging|utilizing|utilising|via)\s+[A-Za-z0-9./+#-]+(,\s*[A-Za-z0-9./+#-]+){2,}[^.]{0,40}\.?$/;

/** Words that are almost always doing nothing. Capped as a share of sentences. */
export const FILLER_ADJECTIVES = [
  'scalable', 'secure', 'robust', 'seamless', 'cutting-edge', 'state-of-the-art',
  'best-in-class', 'world-class', 'high-quality', 'business-critical',
  'mission-critical', 'next-generation', 'industry-leading',
];

/**
 * Prose tells distilled from the `deslop` skill in every-app/open-seo.
 *
 * That catalogue runs to ~980 lines. Run against a real corpus it produced nine
 * hits, eight of them false positives, because it is tuned for essays and
 * marketing copy. Only the patterns that scored zero false positives are here.
 */
export const PROSE_TELLS = [
  ['throat-clearing opener', /\b((here'?s|here is) (the|what|why|where|this|that)\b|the truth is\b|it turns out\b|let me be clear\b)/i],
  ['"serves as" dodge', /\bserves?\s+as\s+a\b/i],
  ['"it\'s worth noting"', /\b(it'?s|it is) worth (noting|mentioning)\b/i],
  ['"think of it as"', /\bthink of (it|this) as\b/i],
  ['"imagine a world"', /\bimagine a world\b/i],
  ['stakes inflation', /\b(game[- ]chang\w+|revolutionis\w+|revolutioniz\w+|redefin\w+ what)\b/i],
  ['magic adverb', /\b(quietly|seamlessly|effortlessly) (deliver|enabl|power|transform|scal)\w*/i],
];

/** Filler that costs credibility and carries no information. */
export const BANNED = [
  /\bresponsible for\b/i,
  /\bhelped (with|to)\b/i,
  /\bassisted (with|in)\b/i,
  /\bpassionate (about|for)\b/i,
  /\bresults[- ]driven\b/i,
  /\bteam player\b/i,
  /\bthrives? in\b/i,
  /\bfast[- ]paced environment\b/i,
  /\bgo[- ]getter\b/i,
  /\bimproved performance\b(?!\s+by)/i,
  /\benhanced efficiency\b(?!\s+by)/i,
];

/**
 * Plain replacements. This is not a filter to slip past - it is the vocabulary
 * the linter expects you to use instead.
 */
export const PLAIN_SWAPS = {
  leverage: 'use, apply, draw on',
  utilize: 'use',
  utilise: 'use',
  harness: 'use, apply',
  spearhead: 'lead, start, launch',
  robust: 'strong, reliable',
  comprehensive: 'thorough, broad',
  extensive: 'broad, deep',
  facilitate: 'run, lead, coordinate',
  meticulous: 'careful, precise',
  foster: 'support, build, grow',
  showcase: 'show, demonstrate',
  delve: 'dig into, examine',
  myriad: 'many',
  plethora: 'many, too many',
  crucial: 'important, necessary',
  consequently: 'so',
  subsequently: 'then',
  additionally: 'and, also',
  moreover: 'and',
  furthermore: 'and',
};

/**
 * Which rules fail a run and which only report.
 *
 * The split is not arbitrary. Everything on the error list matched a fixed
 * phrase and produced zero false positives against real technical writing. The
 * warn list is heuristics - ratios and rhythm - which are useful signals and bad
 * gates: a short, factual README legitimately trips `abstraction`, and failing
 * builds over it is how a checker gets switched off.
 */
export const SEVERITY = {
  'ai-phrase': 'error',
  'filler-phrase': 'error',
  'prose-tell': 'error',
  'adjective-pair': 'error',
  'tech-list-tail': 'error',
  'vague-tail': 'error',
  'passive-voice': 'warn',
  abstraction: 'warn',
  'ai-word': 'warn',
  'filler-adjective': 'warn',
  'repeated-opener': 'warn',
  'flat-rhythm': 'warn',
  'em-dash': 'warn',
};

/** Thresholds. Override any of these from the config file. */
export const DEFAULTS = {
  maxEmDashesPerDoc: 2,
  maxPassiveRatio: 0.25,
  maxAbstractRatio: 0.5,
  maxFillerAdjectiveSentences: 2,
  maxRepeatedOpeners: 2,
  maxSimilarLengthRun: 3,
  similarLengthTolerance: 3,   // words
  minRhythmSentenceWords: 9,   // short sentences are not a rhythm tell
  warnOnAiWords: true,
  severity: SEVERITY,
};

/**
 * `--preset resume` - the strict end. A CV is a list of claims, so every bullet
 * should name a system, a client or a number, and the ratio rules become gates.
 */
export const PRESETS = {
  docs: {},
  resume: {
    maxAbstractRatio: 0.3,
    maxPassiveRatio: 0.2,
    maxEmDashesPerDoc: 2,
    severity: { ...SEVERITY, abstraction: 'error', 'passive-voice': 'error' },
  },
  strict: {
    maxAbstractRatio: 0.3,
    maxPassiveRatio: 0.15,
    severity: Object.fromEntries(Object.keys(SEVERITY).map((k) => [k, 'error'])),
  },
};
