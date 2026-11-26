/**
 * Word-level comparison of an original text with an AI correction. Every changed fragment is checked
 * on its own: only spelling, grammar, punctuation and capitalisation are applied. Anything that could
 * change meaning (numbers, units, negations, Latin or catalogue names, replaced words) is discarded and
 * the specialist's text stays. Pure code, no network.
 */
export interface Change {
  from: string;
  to: string;
}
export type Part = { text: string } | Change;

export interface SafeMerge {
  /** The original with only the safe changes applied. */
  text: string;
  /** The same result as a sequence of unchanged text and changes, for highlighting. */
  parts: Part[];
  changes: Change[];
  /** How many suggested changes were discarded. */
  rejected: number;
}

const TOKEN = /\s+|\d+(?:[.,]\d+)*|\p{L}+(?:-\p{L}+)*|[^\s]/gu;
const tokenize = (s: string) => s.match(TOKEN) ?? [];

const words = (s: string): string[] => s.toLowerCase().replace(/ё/g, "е").match(/\p{L}+/gu) ?? [];
const letters = (s: string) => words(s).join("");

/** Everything that carries quantity: numbers, maths signs and ranges. */
const quantities = (s: string) =>
  (s.replace(/(\d)\s*[-–—−]\s*(?=\d)/g, "$1~").match(/\d+(?:[.,]\d+)*|[%‰+×*/<>=≤≥±°№~^]|[-−](?=\d)/g) ?? []).join(" ");

const UNITS = new Set("мг мкг г кг мл л ме ед см мм шт ч час часа часов мин сек сут дн нед мес капля капли капель".split(" "));
/** Small words whose replacement flips an instruction. */
const POLARITY = new Set("до после перед вместо кроме или можно нельзя".split(" "));
const isNegation = (w: string) => /^(?:не|ни|нет|без)/.test(w);

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export function isSafeChange(from: string, to: string, protectedWords: ReadonlySet<string> = new Set()): boolean {
  if (quantities(from) !== quantities(to)) return false;
  const a = words(from);
  const b = words(to);
  const same = (pick: (w: string) => boolean) => a.filter(pick).join(" ") === b.filter(pick).join(" ");
  if (!same((w) => /[a-z]/.test(w))) return false;
  if (!same((w) => UNITS.has(w))) return false;
  if (a.some((w) => protectedWords.has(w) && !b.includes(w))) return false;
  const x = letters(from);
  const y = letters(to);
  // Punctuation, capitals, spaces, ё: the letters themselves are unchanged.
  if (x === y) return true;
  if (!same((w) => POLARITY.has(w))) return false;
  // «гипер-» and «гипо-» differ by two letters and mean the opposite.
  const direction = (s: string) => (s.match(/гипер|гипо/g) ?? []).join();
  if (direction(x) && direction(y) && direction(x) !== direction(y)) return false;
  if (a.filter(isNegation).length !== b.filter(isNegation).length) return false;
  // Words may be corrected, not added, removed or swapped for different ones.
  if (!x || !y) return false;
  const longest = Math.max(x.length, y.length);
  return distance(x, y) <= (longest <= 3 ? 1 : Math.max(2, Math.floor(longest * 0.2)));
}

/** Longest common subsequence of tokens → alternating equal and changed fragments. */
function diff(a: string[], b: string[]): Part[] {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const parts: Part[] = [];
  let same = "";
  let from = "";
  let to = "";
  const flush = () => {
    if (from || to) {
      parts.push({ from, to });
      from = to = "";
    }
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      same += a[i];
      i++;
      j++;
      continue;
    }
    if (same) {
      parts.push({ text: same });
      same = "";
    }
    if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) from += a[i++];
    else to += b[j++];
  }
  flush();
  if (same) parts.push({ text: same });
  return parts;
}

/**
 * Joins two changes separated by a space when only together they make sense
 * («не большой» → «небольшой»); independent changes stay separate, so one bad one does not drag others.
 */
function joinSplitWords(parts: Part[], protectedWords: ReadonlySet<string>): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    while (!("text" in part)) {
      const gap = parts[i + 1];
      const next = parts[i + 2];
      if (!gap || !next || !("text" in gap) || !/^\s+$/.test(gap.text) || "text" in next) break;
      const joined = { from: part.from + gap.text + next.from, to: part.to + gap.text + next.to };
      const separately = isSafeChange(part.from, part.to, protectedWords) && isSafeChange(next.from, next.to, protectedWords);
      if (separately || !isSafeChange(joined.from, joined.to, protectedWords)) break;
      part = joined;
      i += 2;
    }
    out.push(part);
  }
  return out;
}

export function safeMerge(original: string, corrected: string, protectedTerms: Iterable<string> = []): SafeMerge {
  const protectedWords = new Set([...protectedTerms].flatMap(words).filter((w) => w.length >= 3));
  const result: Part[] = [];
  const changes: Change[] = [];
  let rejected = 0;
  const keep = (text: string) => {
    const last = result.at(-1);
    if (last && "text" in last) last.text += text;
    else result.push({ text });
  };
  for (const part of joinSplitWords(diff(tokenize(original), tokenize(corrected)), protectedWords)) {
    if ("text" in part) keep(part.text);
    else if (isSafeChange(part.from, part.to, protectedWords)) {
      result.push(part);
      changes.push(part);
    } else {
      rejected++;
      keep(part.from);
    }
  }
  const text = result.map((p) => ("text" in p ? p.text : p.to)).join("");
  // Last check on the whole result: quantities must be exactly the original ones.
  if (quantities(text) !== quantities(original)) return { text: original, parts: [{ text: original }], changes: [], rejected: rejected + changes.length };
  return { text, parts: result, changes, rejected };
}
