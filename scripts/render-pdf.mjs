// Dev tool: renders every page of a PDF to PNG and prints page sizes + fonts.
// Usage: node scripts/render-pdf.mjs <input.pdf> <outDir> [scale]
// Output goes outside the repo (reference PDFs contain personal data).
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [input, outDir, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 1);
fs.mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(fs.readFileSync(input));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
console.log("pages:", doc.numPages);
const fonts = new Set();

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  const file = path.join(outDir, `p${String(i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  const tc = await page.getTextContent();
  tc.items.forEach((it) => it.fontName && fonts.add(it.fontName));
  const links = (await page.getAnnotations()).filter((a) => a.url).map((a) => a.url);
  const [x0, y0, x1, y1] = page.view;
  console.log(`p${i}: ${x1 - x0}x${y1 - y0}pt, text items ${tc.items.length}, links ${links.length}`);
}
console.log("fonts:", [...fonts].join(", "));
