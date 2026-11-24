import { createCanvas, loadImage } from "@napi-rs/canvas";
const S = "C:/Users/ICOMP/AppData/Local/Temp/claude/8e0fbf2bad8bc322/a98682cf-d350-431d-9137-3ec4a3027253/scratchpad/ref/c1";
async function darkest(file, [x0, y0, x1, y1]) {
  const img = await loadImage(`${S}/${file}`); const c = createCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; let best = [255, 255, 255], bl = 1e9;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (l < bl) { bl = l; best = [d[i], d[i + 1], d[i + 2]]; } }
  return "#" + best.map((n) => n.toString(16).padStart(2, "0")).join("");
}
console.log("p2 title", await darkest("p02.png", [20, 30, 240, 60]));
console.log("p2 fio name", await darkest("p02.png", [70, 95, 235, 120]));
console.log("p2 body text", await darkest("p02.png", [40, 170, 120, 185]));
console.log("p8 price", await darkest("p08.png", [335, 195, 380, 215]));
console.log("p8 item", await darkest("p08.png", [40, 160, 200, 178]));
console.log("p2 vertical", await darkest("p02.png", [3, 90, 15, 200]));
console.log("p5 heading", await darkest("p05.png", [20, 30, 260, 60]));
console.log("p3 body", await darkest("p03.png", [25, 70, 200, 80]));
console.log("p9 num", await darkest("p09.png", [40, 80, 70, 100]));
console.log("p4 face legend green", await darkest("p04.png", [255, 245, 285, 252]));
