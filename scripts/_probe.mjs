import fs from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync("references/card-01.pdf")) }).promise;
const page = await doc.getPage(8);
const tc = await page.getTextContent();
const v = tc.items.find((i) => i.str.startsWith("@cosmetology"));
console.log("vertical transform", v.transform.map((n) => +n.toFixed(2)), v.str);
for (const [pn, items] of [[3, 12], [4, 12], [5, 14], [9, 10], [10, 12]]) {
  const pg = await doc.getPage(pn); const t = await pg.getTextContent(); await pg.getOperatorList();
  console.log("--- page", pn);
  for (const it of t.items.filter((i) => i.str.trim()).slice(0, items)) {
    let name = "?"; try { name = pg.commonObjs.get(it.fontName).name.split("+")[1]; } catch {}
    const size = Math.hypot(it.transform[2], it.transform[3]);
    console.log(name.padEnd(15), "sz", size.toFixed(1), "x", it.transform[4].toFixed(0), "top", (822 - it.transform[5] - size * 0.8).toFixed(0), "w", it.width.toFixed(0), JSON.stringify(it.str.slice(0, 10)));
  }
}
// sample colours from the 0.7 renders
const S = "C:/Users/ICOMP/AppData/Local/Temp/claude/8e0fbf2bad8bc322/a98682cf-d350-431d-9137-3ec4a3027253/scratchpad/ref/c1";
async function px(file, pts) {
  const img = await loadImage(`${S}/${file}`); const c = createCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  return pts.map(([x, y]) => { const d = g.getImageData(x, y, 1, 1).data; return `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`; });
}
console.log("p2 bg/card/title", await px("p02.png", [[8, 300], [200, 480], [30, 45]]));
console.log("p10 button, card", await px("p10.png", [[30, 480], [100, 400]]));
console.log("p5 bg", await px("p05.png", [[10, 300]]));
