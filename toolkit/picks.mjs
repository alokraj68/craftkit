/**
 * Turn what someone typed at the menu into a list of bucket keys.
 *
 * Option 1 is Everything, so the buckets themselves start at 2. That offset is
 * easy to get wrong in a way that installs the wrong set without erroring,
 * which is why it lives here with a test rather than inline in the wizard.
 *
 * @param {string} raw    what was typed, already trimmed and lowercased
 * @param {string[]} keys bucket keys in menu order
 * @param {(msg: string) => void} [warn] called once per unparseable token
 * @returns {string[]} selected bucket keys, in menu order, deduplicated
 */
export function pickBuckets(raw, keys, warn = () => {}) {
  if (raw === 'all') return keys;
  const picked = new Set();
  for (const part of raw.split(/[,\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) for (let i = +range[1]; i <= +range[2]; i++) picked.add(i);
    else if (/^\d+$/.test(part)) picked.add(+part);
    else warn(part);
  }
  if (picked.has(1)) return keys;
  return keys.filter((_, i) => picked.has(i + 2));
}
