/**
 * Deterministic text helpers for dictation. They never need a network and never touch numbers, product
 * names or doses: they only handle spoken punctuation, spacing and capitalisation.
 */

// JavaScript's \b knows only ASCII letters, so Cyrillic commands need Unicode-aware boundaries.
const command = (words: string) => new RegExp(`\\s*(?<![\\p{L}\\p{N}])(?:${words})(?![\\p{L}\\p{N}])\\s*`, "giu");

const WORD_MARKS: [RegExp, string][] = [
  [command("точка с запятой"), "; "],
  [command("восклицательный знак"), "! "],
  [command("вопросительный знак"), "? "],
  [command("двоеточие"), ": "],
  [command("запятая"), ", "],
  [command("новый абзац|с нового абзаца"), "\n\n"],
  [command("новая строка|с новой строки"), "\n"],
  [command("открыть скобку"), " ("],
  [command("закрыть скобку"), ") "],
];

/** Words after which «точка» is a noun («нанести на точку»), not a command. */
const NOUN_BEFORE_POINT = /(?:^|\s)(?:на|в|во|по|за|до|от|эту|ту|одну|каждую|любую|какую|нужную|болевую|сосудистую|проблемную|одной|каждой|этой|другую)$/iu;
const FINAL_POINT = /^([\s\S]*?)\s*(?<![\p{L}\p{N}])точка\s*$/iu;

/** Converts spoken punctuation ("запятая", "двоеточие", "новая строка"…) into characters. */
export function applySpokenPunctuation(input: string): string {
  let t = input;
  for (const [re, sym] of WORD_MARKS) t = t.replace(re, sym);
  // «точка» only when it is the very last word of the phrase and clearly a command.
  const m = FINAL_POINT.exec(t);
  if (m && m[1].trim() && !NOUN_BEFORE_POINT.test(m[1])) t = `${m[1].trimEnd()}.`;
  return t.replace(/[ \t]+$/g, "");
}

const SENTENCE_END = /(?:[.!?…]|\n)\s*$/u;

/**
 * Light offline tidy-up: spacing around punctuation and a capital letter at the start of a sentence.
 * `before` is the text already in the field (decides whether this phrase starts a sentence).
 */
export function localTidy(phrase: string, before = ""): string {
  let t = phrase
    .replace(/[ \t ]+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/([;:!?])(?=[^\s\d"')\]])/g, "$1 ")
    .replace(/,(?=\p{L})/gu, ", ")
    .replace(/ *\n */g, "\n")
    .trim();
  if (!t) return "";
  if (before.trim() === "" || SENTENCE_END.test(before)) t = t[0].toLocaleUpperCase("ru-RU") + t.slice(1);
  return t;
}

/** Joins an inserted phrase to the existing text with exactly one space/newline where needed. */
export function joinPhrase(before: string, phrase: string): string {
  if (!before) return phrase;
  if (!phrase) return before;
  if (/[\s(«]$/u.test(before) || /^[\s,.;:!?)»\n]/u.test(phrase)) return before + phrase;
  return `${before} ${phrase}`;
}

const NUM = /\d+(?:[.,]\d+)?/g;

/**
 * Safety net for AI corrections: a spelling fix must not change any number (doses!), must not add or
 * drop whole sentences, and must not rewrite the text. If any check fails, the original is kept.
 */
export function isSafeCorrection(raw: string, corrected: string): boolean {
  const c = corrected.trim();
  if (!c) return false;
  const numbers = (s: string) => (s.match(NUM) ?? []).map((n) => n.replace(",", ".")).sort();
  const a = numbers(raw);
  const b = numbers(c);
  if (a.length !== b.length || a.some((n, i) => n !== b[i])) return false;
  const ratio = c.length / Math.max(1, raw.trim().length);
  if (ratio < 0.75 || ratio > 1.4) return false;
  const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return Math.abs(words(raw).length - words(c).length) <= Math.max(2, Math.ceil(words(raw).length * 0.15));
}
