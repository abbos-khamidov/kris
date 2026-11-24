/**
 * Inline markup used inside card text:  **bold**   ==burgundy highlight==   !!warning!!
 * Unclosed markers are kept as plain text, so nothing the specialist typed is ever lost.
 */
export type RunStyle = "normal" | "bold" | "accent" | "warn";
export interface Run {
  text: string;
  style: RunStyle;
}

const MARKS: [string, RunStyle][] = [
  ["**", "bold"],
  ["==", "accent"],
  ["!!", "warn"],
];

export function parseInline(input: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) runs.push({ text: buf, style: "normal" });
    buf = "";
  };
  while (i < input.length) {
    const mark = MARKS.find(([m]) => input.startsWith(m, i));
    if (mark) {
      const [m, style] = mark;
      const end = input.indexOf(m, i + m.length);
      if (end > i + m.length) {
        flush();
        runs.push({ text: input.slice(i + m.length, end), style });
        i = end + m.length;
        continue;
      }
    }
    buf += input[i++];
  }
  flush();
  return runs;
}

/** Plain text without markers (used by search / dedupe / checks). */
export const stripInline = (s: string) => parseInline(s).map((r) => r.text).join("");
