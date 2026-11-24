export type InsertMode = "cursor" | "append" | "replace";

export interface InsertResult {
  value: string;
  /** Caret position right after the inserted text. */
  caret: number;
}

/** Adds a space/newline only where two words would otherwise touch. */
function glue(before: string, text: string, after: string): string {
  const needLeft = before.length > 0 && !/[\s(«"'-]$/.test(before) && !/^[\s.,;:!?)»]/.test(text);
  const needRight = after.length > 0 && !/^[\s.,;:!?)»]/.test(after) && !/[\s(«]$/.test(text);
  return `${needLeft ? " " : ""}${text}${needRight ? " " : ""}`;
}

/**
 * Pure helper used by VoiceInput. Never alters anything outside the chosen range:
 *  - cursor:  insert at selectionStart (selection is kept, nothing is deleted)
 *  - append:  add to the end (on a new line for multiline fields with existing text)
 *  - replace: replace exactly the selected range (the UI shows what will be replaced)
 */
export function insertDictation(
  value: string,
  text: string,
  mode: InsertMode,
  selStart: number,
  selEnd: number,
  multiline: boolean,
): InsertResult {
  const clean = text.trim();
  if (!clean) return { value, caret: selStart };
  const start = Math.max(0, Math.min(selStart, value.length));
  const end = Math.max(start, Math.min(selEnd, value.length));

  if (mode === "append") {
    const sep = value.length === 0 || /^[\s.,;:!?)»]/.test(clean) ? "" : multiline && !value.endsWith("\n") ? "\n" : /\s$/.test(value) ? "" : " ";
    const next = `${value}${sep}${clean}`;
    return { value: next, caret: next.length };
  }
  const before = value.slice(0, start);
  const after = mode === "replace" ? value.slice(end) : value.slice(start);
  const piece = glue(before, clean, after);
  const next = `${before}${piece}${after}`;
  return { value: next, caret: before.length + piece.length };
}
