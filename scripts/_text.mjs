import fs from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const [file, pagesArg] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), fontExtraProperties: true }).promise;
for (const p of pagesArg.split(",").map(Number)) {
  const page = await doc.getPage(p);
  await page.getOperatorList();
  const H = page.view[3];
  const tc = await page.getTextContent();
  console.log(`--- page ${p}`);
  const rows = [];
  for (const it of tc.items) {
    if (!it.str?.trim()) continue;
    let name = "?";
    try { name = page.commonObjs.get(it.fontName).name.split("+")[1]; } catch {}
    const size = Math.hypot(it.transform[2], it.transform[3]);
    rows.push(`${name.padEnd(16)} sz=${size.toFixed(1).padStart(5)} x=${it.transform[4].toFixed(0).padStart(3)} top=${(H - it.transform[5] - size * 0.8).toFixed(0).padStart(3)} w=${it.width.toFixed(0).padStart(3)} "${it.str.slice(0, 14)}"`);
  }
  console.log(rows.slice(0, 40).join("\n"));
}
