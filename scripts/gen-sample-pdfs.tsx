// Dev tool: renders the three fictional sample cards with the SAME renderer the app uses.
// Usage: npx tsx scripts/gen-sample-pdfs.tsx [outDir]
// Brand images are read from assets-private/brand (never committed).
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CardDocument } from "../src/pdf/CardDocument";
import { registerPdfFonts } from "../src/pdf/fonts";
import { sampleSnapshot, type SampleKind } from "../src/pdf/sample";
import { BRAND_SLOTS } from "../src/pdf/tokens";

const outDir = process.argv[2] ?? "assets-private/samples";
fs.mkdirSync(outDir, { recursive: true });
registerPdfFonts(path.resolve("public/fonts"));

const brand: Record<string, { data: Uint8Array; format: "jpg" }> = {};
for (const slot of BRAND_SLOTS) {
  const file = path.resolve("assets-private/brand", `${slot}.jpg`);
  if (fs.existsSync(file)) brand[slot] = { data: fs.readFileSync(file), format: "jpg" };
}

async function main() {
const kinds: SampleKind[] = ["short-frame", "long-burgundy-bottom", "mixed-burgundy-top"];
for (const kind of kinds) {
  const snap = { ...sampleSnapshot(kind), brand };
  const t = Date.now();
  const buf = await renderToBuffer(<CardDocument snapshot={snap} />);
  fs.writeFileSync(path.join(outDir, `sample-${kind}.pdf`), buf);
  console.log(kind, `${Math.round(buf.length / 1024)} KB`, `${Date.now() - t} ms`);
}
}
main();
