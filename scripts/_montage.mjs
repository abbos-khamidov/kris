import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const dir = process.argv[2];
const out = process.argv[3];
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
const T = 170, cols = 7, rows = Math.ceil(files.length / cols);
const c = createCanvas(cols * (T + 6), rows * (T + 22));
const g = c.getContext("2d");
g.fillStyle = "#c8c8c8"; g.fillRect(0, 0, c.width, c.height);
let i = 0;
for (const f of files) {
  const img = await loadImage(path.join(dir, f));
  const s = Math.min(T / img.width, T / img.height);
  const x = (i % cols) * (T + 6) + 3, y = Math.floor(i / cols) * (T + 22) + 3;
  g.fillStyle = "#fff"; g.fillRect(x, y, T, T);
  g.drawImage(img, x, y, img.width * s, img.height * s);
  g.fillStyle = "#000"; g.font = "12px sans-serif"; g.fillText(f.replace(".png", ""), x, y + T + 14);
  i++;
}
fs.writeFileSync(out, c.toBuffer("image/png"));
