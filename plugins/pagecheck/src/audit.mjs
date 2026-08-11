// The two audits, as functions that run inside the page.
//
// Both are written as plain source strings evaluated in the browser, so they
// carry no imports and can be handed straight to page.evaluate().
//
// The hard part here was never the checks. It was making them quiet enough to
// be believed. Three classes of false positive had to go first:
//
//   1. getClientRects() returns one rect per inline-block box, not one per
//      rendered line. An element holding <b>, an icon or per-word animation
//      spans reports a dozen "lines" for one, and every rag figure derived from
//      it is meaningless.
//   2. Scroll animations leave each element at its own transform mid-scrub, so
//      measurement has to freeze motion first.
//   3. Stacked block children (a heading over a subtitle over a date) are
//      separate lines by design. Measured as wrapped prose, the shortest one
//      reads as a catastrophic gap.
//
// A noisy checker is worse than no checker: it trains you to ignore it.

/** Freeze transforms and animations so measurement is stable. */
const FREEZE = `
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transform:none!important;animation:none!important;transition:none!important}';
  document.head.appendChild(freeze);
  void document.documentElement.offsetHeight;
`;

export const layoutAudit = `() => {
  ${FREEZE}
  const doc = document.documentElement;
  const vw = doc.clientWidth;

  // 1. Horizontal overflow, and what causes it.
  const overflow = doc.scrollWidth - vw;
  const wide = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.overflowX === 'hidden' || style.overflowX === 'clip') continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const cls = (el.className || '').toString().split(' ')[0];
        wide.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' -> ' + Math.round(r.right - vw) + 'px past edge');
      }
    }
  }

  // 2. Ragged paragraphs, measured per rendered line.
  const ragged = [];
  for (const el of document.querySelectorAll('p, li, h1, h2, h3')) {
    const txt = el.textContent.trim();
    if (txt.length < 60) continue;
    const align = getComputedStyle(el).textAlign;
    if (align === 'center' || align === 'justify') continue;
    if (el.querySelector('br')) continue;
    // Any descendant that stacks and carries text means these are separate lines
    // by design. inline-block is excluded on purpose: per-word animation spans
    // are inline-block and must stay measurable.
    const hasBlockChild = [...el.querySelectorAll('*')].some((c) => {
      const d = getComputedStyle(c).display;
      const stacks = d === 'block' || d === 'flex' || d === 'grid' || d === 'list-item';
      return stacks && c.textContent.trim().length > 0;
    });
    if (hasBlockChild) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    // Cluster rects into visual lines. One rendered line often yields several
    // rects whose tops differ by a pixel, and exact grouping counts it twice.
    const lines = [];
    for (const r of [...range.getClientRects()].filter((x) => x.width >= 1).sort((a, b) => a.top - b.top)) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(r.top - last.top) <= 4) {
        last.left = Math.min(last.left, r.left);
        last.right = Math.max(last.right, r.right);
      } else lines.push({ top: r.top, left: r.left, right: r.right });
    }
    if (lines.length < 2) continue;
    const width = Math.max(...lines.map((l) => l.right - l.left));
    // The final line is short by nature; that is not a defect.
    const gaps = lines.slice(0, -1).map((l) => (width - (l.right - l.left)) / width);
    const worst = Math.max(...gaps);
    if (worst > 0.3) ragged.push(Math.round(worst * 100) + '% empty - "' + txt.slice(0, 50) + '"');
  }

  // 3. Text below a comfortable reading size on a phone.
  const tiny = new Set();
  for (const el of document.querySelectorAll('p, li, span, a, div, td, dd')) {
    if (!el.childNodes.length) continue;
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 12);
    if (!direct) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size && size < 12) tiny.add(Math.round(size) + 'px - "' + el.textContent.trim().slice(0, 34) + '"');
  }

  // 4. Tap targets below the 44px floor. Inline links inside a sentence are
  //    text, not buttons - enlarging one would break the line box it lives in.
  const smallTaps = new Set();
  for (const el of document.querySelectorAll('a, button, [role="button"], input, select')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (getComputedStyle(el).display === 'inline') continue;
    if (r.height < 32 && (el.textContent.trim().length > 0 || el.tagName === 'INPUT')) {
      smallTaps.add(Math.round(r.width) + 'x' + Math.round(r.height) + ' - "' + el.textContent.trim().slice(0, 26) + '"');
    }
  }

  // 5. Empty spans left behind by a per-word text split.
  const emptySpans = [...document.querySelectorAll('[data-words] span, [data-split] span')]
    .filter((s) => !s.textContent.trim()).length;

  freeze.remove();
  return {
    overflow,
    wide: [...new Set(wide)].slice(0, 5),
    ragged: ragged.slice(0, 5),
    tiny: [...tiny].slice(0, 4),
    smallTaps: [...smallTaps].slice(0, 4),
    emptySpans,
  };
}`;

export const typeAudit = `() => {
  ${FREEZE}
  const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => { const m = (c.match(/[\\d.]+/g) || [0,0,0]).map(Number); return 0.2126*srgb(m[0]) + 0.7152*srgb(m[1]) + 0.0722*srgb(m[2]); };
  // Walk up for the first painted background: a transparent element inherits
  // whatever is behind it, and comparing text against 'transparent' is useless.
  const bgOf = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(.*,\\s*0\\)/.test(c) && c !== 'transparent') return c;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  };

  const rows = new Map();
  for (const el of document.querySelectorAll('p, li, h1, h2, h3, h4, blockquote, figcaption, td, dd, dt')) {
    const text = el.textContent.trim();
    if (text.length < 40) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
    const box = el.getBoundingClientRect();
    const lines = Math.max(1, Math.round(box.height / lh));
    const cpl = Math.round(text.length / lines);
    const L1 = lum(cs.color), L2 = lum(bgOf(el));
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const isDisplay = size >= 24 || /H[1-4]/.test(el.tagName);
    const key = el.tagName + '|' + Math.round(size) + '|' + cs.fontWeight + '|' + (lh/size).toFixed(2) + '|' + contrast.toFixed(1);
    const row = rows.get(key) ?? {
      tag: el.tagName.toLowerCase(), size: Math.round(size), weight: cs.fontWeight,
      leading: +(lh/size).toFixed(2), contrast: +contrast.toFixed(1), isDisplay,
      count: 0, cpl: [], sample: text.slice(0, 40),
    };
    row.count++; row.cpl.push(cpl);
    rows.set(key, row);
  }
  freeze.remove();
  return [...rows.values()].map((r) => ({ ...r, cpl: Math.round(r.cpl.reduce((a,b) => a+b, 0) / r.cpl.length) }));
}`;

/** Judge one typography row. Kept out of the page so it is unit-testable. */
export function typeIssues(r, viewportName, cfg) {
  const issues = [];
  if (!r.isDisplay && r.size < cfg.minBodySize) issues.push(`${r.size}px too small`);
  if (!r.isDisplay && r.leading < cfg.minLeading) issues.push(`leading ${r.leading} tight`);
  if (r.size < 20 && Number(r.weight) <= 300) issues.push(`weight ${r.weight} thin at ${r.size}px`);
  const floor = r.size >= 24 ? 3 : 4.5;
  if (r.contrast < floor) issues.push(`contrast ${r.contrast}:1 below AA`);
  if (r.cpl > cfg.maxCharsPerLine) issues.push(`${r.cpl} chars/line too wide`);
  // Narrow measure is only meaningful on a wide viewport: at 390px a readable
  // 16px face physically cannot reach 45 characters, so flagging it is noise.
  if (viewportName === 'desktop' && r.cpl < cfg.minCharsPerLine && r.count > 1) {
    issues.push(`${r.cpl} chars/line narrow`);
  }
  return issues;
}

export const DEFAULTS = {
  viewports: [
    { name: 'iPhone SE', width: 375, height: 667, mobile: true },
    { name: 'iPhone 14', width: 390, height: 844, mobile: true },
    { name: 'desktop', width: 1280, height: 900, mobile: false },
  ],
  minBodySize: 14,
  minLeading: 1.4,
  maxCharsPerLine: 85,
  minCharsPerLine: 45,
  maxRagRatio: 0.3,
  settleMs: 700,
  failOn: ['overflow'],
};
