// Dev tool: dumps embedded raster images of a reference PDF (+ where they are placed on the page).
// Usage: node scripts/extract-images.mjs <input.pdf> <outDir>
// Output goes to assets-private/ (gitignored): these are brand assets, never committed.
import fs from "node:fs";
import path from "node:path";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const [input, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(input)) }).promise;
const report = [];

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const [, , pw, ph] = page.view;
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let n = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      let img;
      if (fn === OPS.paintInlineImageXObject) img = args[0];
      else {
        const name = args[0];
        img = await new Promise((resolve) => {
          const holder = name.startsWith("g_") ? page.commonObjs : page.objs;
          holder.get(name, resolve);
        });
      }
      if (!img || !img.data) continue;
      const { width, height, kind } = img;
      const rgba = new Uint8ClampedArray(width * height * 4);
      if (kind === 3) rgba.set(img.data); // RGBA_32BPP
      else if (kind === 2) for (let k = 0, j = 0; k < img.data.length; k += 3, j += 4) { rgba[j] = img.data[k]; rgba[j + 1] = img.data[k + 1]; rgba[j + 2] = img.data[k + 2]; rgba[j + 3] = 255; }
      else { // GRAYSCALE_1BPP: skip masks
        continue;
      }
      const canvas = createCanvas(width, height);
      canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
      const file = `p${String(p).padStart(2, "0")}-i${n}.png`;
      fs.writeFileSync(path.join(outDir, file), canvas.toBuffer("image/png"));
      // Placement in top-left page coordinates (pt)
      const w = Math.hypot(ctm[0], ctm[1]);
      const h = Math.hypot(ctm[2], ctm[3]);
      const x = ctm[4];
      const y = ph - ctm[5] - h;
      report.push({ page: p, file, px: `${width}x${height}`, placed: { x: +x.toFixed(1), y: +y.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) } });
      n++;
    }
  }
}
console.table(report);
