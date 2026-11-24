import fs from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const E = "assets-private/extracted";
const map = {
  cover: `${E}/card-01/p01-i0.png`,
  bg_products: `${E}/card-01/p03-i0.png`,
  bg_room: `${E}/card-01/p04-i0.png`,
  face_illustration: `${E}/card-01/p04-i4.png`,
  side_actives_top: `${E}/card-01/p05-i3.png`,
  side_actives_bottom: `${E}/card-01/p05-i1.png`,
  side_nutrition: `${E}/card-01/p06-i1.png`,
  side_vitamins: `${E}/card-01/p07-i1.png`,
  specialist: `${E}/card-01/p10-i3.png`,
};
for (const [role, file] of Object.entries(map)) {
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, img.width, img.height);
  g.drawImage(img, 0, 0);
  const buf = c.toBuffer("image/jpeg", 88);
  fs.writeFileSync(`assets-private/brand/${role}.jpg`, buf);
  console.log(role, img.width + "x" + img.height, Math.round(buf.length / 1024) + "KB");
}
