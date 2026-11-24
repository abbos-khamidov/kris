import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
// node _pages.mjs <dir> <out.png> <from> <to> [cols] [thumbW]
const [dir, out, from, to, colsArg, wArg] = process.argv.slice(2);
const cols = Number(colsArg ?? 5), W = Number(wArg ?? 300);
const files = fs.readdirSync(dir).filter((f) => /^p\d+\.png$/.test(f)).sort().slice(Number(from) - 1, Number(to));
const imgs = await Promise.all(files.map((f) => loadImage(path.join(dir, f))));
const H = Math.round(W * (imgs[0].height / imgs[0].width));
const rows = Math.ceil(imgs.length / cols);
const c = createCanvas(cols * (W + 8), rows * (H + 8));
const g = c.getContext("2d"); g.fillStyle = "#777"; g.fillRect(0, 0, c.width, c.height);
imgs.forEach((im, i) => g.drawImage(im, (i % cols) * (W + 8) + 4, Math.floor(i / cols) * (H + 8) + 4, W, H));
fs.writeFileSync(out, c.toBuffer("image/png"));
