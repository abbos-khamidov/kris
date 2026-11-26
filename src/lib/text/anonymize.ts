/**
 * Removes personal data before a text leaves the application. Each fragment becomes a numbered marker
 * and is put back afterwards, so the AI never sees it. Covers: names of the specialist's patients
 * (including Russian case endings), surname + initials, patronymics, e-mail, links, @handles, phones,
 * dates and long digit sequences (documents). A name of somebody who is not a patient and is written
 * without initials or patronymic cannot be recognised.
 */
export interface Anonymized {
  text: string;
  /** Puts the originals back; null if a marker was lost, duplicated or invented. */
  restore: (answer: string) => string | null;
}

const PATTERNS: RegExp[] = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu,
  /(?:https?:\/\/|www\.)\S+/giu,
  /(?<![\p{L}\p{N}])@[A-Za-z0-9_.]{3,}/gu,
  /(?<!\d)(?:\+7|8)[\s-]*\(?\d{3}\)?(?:[\s-]*\d){7}(?!\d)/g,
  /\+\d(?:[\s()-]*\d){8,13}/g,
  /(?<!\d)\d{1,2}[./]\d{1,2}[./](?:19|20)?\d{2}(?!\d)/g,
  /(?<!\d)(?:\d[ -]?){8,}\d(?!\d)/g,
  // Surname + initials, in either order.
  /(?<!\p{L})\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?\s+\p{Lu}\.\s?\p{Lu}\./gu,
  /(?<!\p{L})\p{Lu}\.\s?\p{Lu}\.\s?\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?/gu,
  // Name + patronymic (and an adjacent surname).
  /(?<!\p{L})(?:\p{Lu}\p{Ll}+\s+){1,2}\p{Lu}\p{Ll}*(?:ович|евич|ьич|овн|евн|ичн)\p{Ll}{0,3}(?!\p{L})/gu,
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One pattern per name part; the last one or two letters may differ (declension). */
function namePatterns(names: string[]): RegExp[] {
  const parts = new Set(names.flatMap((n) => n.split(/[\s,()]+/)).filter((p) => /^\p{L}[\p{L}'-]{2,}$/u.test(p)));
  return [...parts].map((p) => {
    const stem = p.length > 5 ? p.slice(0, -2) : p.length > 3 ? p.slice(0, -1) : p;
    return new RegExp(`(?<!\\p{L})${escape(stem)}\\p{L}{0,3}(?!\\p{L})`, "giu");
  });
}

const MARKER = /⟦(\d+)⟧/g;

export function anonymize(input: string, names: string[] = []): Anonymized {
  const originals: string[] = [];
  let text = input.replace(/[⟦⟧]/g, "");
  for (const re of [...PATTERNS, ...namePatterns(names)]) {
    text = text.replace(re, (found) => {
      // Never swallow a marker made by an earlier pattern.
      if (/[⟦⟧]/.test(found)) return found;
      originals.push(found);
      return `⟦${originals.length}⟧`;
    });
  }
  return {
    text,
    restore(answer) {
      const found = [...answer.matchAll(MARKER)].map((m) => Number(m[1]));
      const expected = [...text.matchAll(MARKER)].map((m) => Number(m[1]));
      if (found.length !== expected.length || found.some((n, i) => n !== expected[i])) return null;
      return answer.replace(MARKER, (_, n: string) => originals[Number(n) - 1]);
    },
  };
}
