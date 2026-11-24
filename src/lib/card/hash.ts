import type { CardData } from "@/lib/schemas/card";
import type { DocContext } from "./resolve";

/** Deterministic JSON (sorted keys) so the same data always hashes the same, in the browser and on the server. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fingerprint of everything that determines the document's content. The browser computes it from the
 * state it rendered; the server recomputes it from the stored state. Equal hashes prove that the PDF
 * being filed was rendered from exactly the data that is being frozen as the snapshot.
 */
export async function docHash(ctx: DocContext, card: CardData): Promise<string> {
  return sha256Hex(stableStringify({ ctx, card }));
}
