import {
  AI_PHRASES, AI_WORDS, VAGUE_TAIL, ADJECTIVE_PAIR, TECH_LIST_TAIL,
  FILLER_ADJECTIVES, PROSE_TELLS, BANNED, PLAIN_SWAPS, DEFAULTS, PRESETS,
} from './rules.mjs';
import {
  stripNonProse, sentences, bullets, withoutBullets, lineAt, words,
  isPassive, isConcrete, opener,
} from './analyze.mjs';

/**
 * Lint one document.
 *
 * @param {string} raw     file contents
 * @param {object} options thresholds, merged over DEFAULTS
 * @returns {{findings: Array, stats: object}}
 */
export function lint(raw, options = {}) {
  const preset = PRESETS[options.preset ?? 'docs'] ?? {};
  const cfg = { ...DEFAULTS, ...preset, ...options };
  cfg.severity = { ...DEFAULTS.severity, ...(preset.severity ?? {}), ...(options.severity ?? {}) };
  const allow = new Set((cfg.allow ?? []).map((w) => String(w).toLowerCase()));
  const prose = stripNonProse(raw);
  // Lines a writer has explicitly exempted. A document about banned phrases has
  // to be able to quote them - this file's own rule list trips six rules
  // otherwise, which is the classic reason people delete their linter.
  const muted = mutedLines(raw);
  const items = bullets(prose);
  // A list item is a unit in its own right, and usually has no full stop, so it
  // would otherwise fuse into the paragraph after it and escape any rule
  // anchored to the end of a sentence.
  const sents = sentences(withoutBullets(prose));
  const units = [...sents, ...items];
  const findings = [];

  const add = (_ignored, rule, offset, message, evidence) => {
    const line = lineAt(prose, offset);
    if (muted.has(line)) return;
    const severity = cfg.severity[rule] ?? 'warn';
    if (severity === 'off') return;
    findings.push({ severity, rule, line, message, evidence });
  };

  /** Report at the offset of the match, not the start of its sentence. */
  const at = (unit, m) => unit.offset + (m?.index ?? 0);

  // ---- unit-level rules (sentences and list items) --------------------------
  let passive = 0;
  let abstract = 0;
  let fillerSentences = 0;

  for (const u of units) {
    const t = u.text;

    for (const re of AI_PHRASES) {
      const m = t.match(re);
      if (m && !allow.has(m[0].toLowerCase())) {
        add('error', 'ai-phrase', at(u, m), `"${m[0]}" has no defensible use`, t);
      }
    }

    for (const re of BANNED) {
      const m = t.match(re);
      if (m && !allow.has(m[0].toLowerCase())) {
        add('error', 'filler-phrase', at(u, m), `"${m[0]}" says nothing`, t);
      }
    }

    for (const [label, re] of PROSE_TELLS) {
      const m = t.match(re);
      if (m && !allow.has(m[0].toLowerCase())) {
        add('error', 'prose-tell', at(u, m), `${label}: "${m[0]}"`, t);
      }
    }

    const pair = t.match(ADJECTIVE_PAIR);
    if (pair) {
      add('error', 'adjective-pair', at(u, pair),
        `"${pair[0]}" - two generic adjectives in a row. Name the thing instead`, t);
    }

    const tail = t.match(TECH_LIST_TAIL);
    if (tail) {
      add('error', 'tech-list-tail', at(u, tail),
        'ends on a list of tools rather than a result', t);
    }

    const vague = t.match(VAGUE_TAIL);
    if (vague) {
      add('error', 'vague-tail', at(u, vague),
        'trails off into a vague clause instead of landing on a result', t);
    }

    if (cfg.warnOnAiWords) {
      for (const w of AI_WORDS) {
        if (allow.has(w)) continue;
        const re = new RegExp(`\\b${w.replace(/[-]/g, '[- ]')}\\w*\\b`, 'i');
        const m = t.match(re);
        if (m) {
          const swap = PLAIN_SWAPS[w];
          add('warn', 'ai-word', at(u, m), `"${m[0]}"${swap ? ` - try: ${swap}` : ''}`, t);
        }
      }
    }

    if (isPassive(t)) passive++;
    if (!isConcrete(t)) abstract++;
    if (FILLER_ADJECTIVES.some((a) => new RegExp(`\\b${a.replace('-', '[- ]')}\\b`, 'i').test(t))) {
      fillerSentences++;
    }
  }

  // Three list items opening on the same word reads as generated.
  let run = 1;
  for (let i = 1; i < items.length; i++) {
    const a = opener(items[i - 1].text);
    const c = opener(items[i].text);
    if (a && a === c) {
      run++;
      if (run > cfg.maxRepeatedOpeners) {
        add('warn', 'repeated-opener', items[i].offset,
          `${run} list items in a row open with "${c}"`, items[i].text);
      }
    } else run = 1;
  }

  // ---- document-level rules -------------------------------------------------
  const emDashes = (prose.match(/—/g) ?? []).length;
  if (emDashes > cfg.maxEmDashesPerDoc) {
    add('warn', 'em-dash', 0,
      `${emDashes} em-dashes (limit ${cfg.maxEmDashesPerDoc})`, null);
  }

  if (units.length >= 5) {
    const pr = passive / units.length;
    if (pr > cfg.maxPassiveRatio) {
      add('error', 'passive-voice', 0,
        `${Math.round(pr * 100)}% of sentences are passive (limit ${Math.round(cfg.maxPassiveRatio * 100)}%)`, null);
    }
    const ar = abstract / units.length;
    if (ar > cfg.maxAbstractRatio) {
      add('error', 'abstraction', 0,
        `${Math.round(ar * 100)}% of sentences name nothing concrete - no number, no proper noun (limit ${Math.round(cfg.maxAbstractRatio * 100)}%)`, null);
    }
  }

  if (fillerSentences > cfg.maxFillerAdjectiveSentences) {
    add('warn', 'filler-adjective', 0,
      `${fillerSentences} sentences lean on filler adjectives (limit ${cfg.maxFillerAdjectiveSentences})`, null);
  }

  // Three consecutive sentences of near-identical length is a rhythm tell.
  let sameRun = 1;
  for (let i = 1; i < sents.length; i++) {
    const a = words(sents[i - 1].text).length;
    const b = words(sents[i].text).length;
    if (a >= cfg.minRhythmSentenceWords && Math.abs(a - b) <= cfg.similarLengthTolerance) {
      sameRun++;
      if (sameRun >= cfg.maxSimilarLengthRun) {
        add('warn', 'flat-rhythm', sents[i].offset,
          `${sameRun} sentences in a row of near-identical length (~${b} words). Vary it`, sents[i].text);
        sameRun = 1;
      }
    } else sameRun = 1;
  }

  return {
    findings,
    stats: {
      sentences: sents.length,
      bullets: items.length,
      units: units.length,
      passive,
      abstract,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warn').length,
    },
  };
}

/**
 * Lines suppressed by an inline comment.
 *
 *   <!-- plainspoken-disable-next-line -->
 *   <!-- plainspoken-disable -->  ...  <!-- plainspoken-enable -->
 *
 * Also honours the same directives written as `//` or `#` comments, so the file
 * type does not decide whether the escape hatch exists.
 */
function mutedLines(raw) {
  const muted = new Set();
  const lines = raw.split('\n');
  let blockOff = false;
  lines.forEach((text, i) => {
    const n = i + 1;
    if (/plainspoken-enable\b/.test(text)) blockOff = false;
    if (blockOff) muted.add(n);
    if (/plainspoken-disable-next-line\b/.test(text)) { muted.add(n); muted.add(n + 1); }
    if (/plainspoken-disable\b(?!-next-line)/.test(text)) { blockOff = true; muted.add(n); }
    if (/plainspoken-disable-line\b/.test(text)) muted.add(n);
  });
  return muted;
}
