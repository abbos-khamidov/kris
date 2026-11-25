// Generates the PWA icons from the brand font (Prata, OFL). Run: node scripts/make-icons.mjs
import fs from "node:fs";
import { GlobalFonts, createCanvas } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("public/fonts/Prata_400Regular.ttf", "Prata");
function icon(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext("2d");
  g.fillStyle = "#791F2B";
  g.fillRect(0, 0, size, size);
  // maskable icons keep the mark inside the central 80% safe zone
  const scale = maskable ? 0.52 : 0.62;
  g.fillStyle = "#F5F1ED";
  g.font = `${Math.round(size * scale)}px Prata`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const m = g.measureText("K");
  g.fillText("K", size / 2, size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  g.strokeStyle = "rgba(245,241,237,0.55)";
  g.lineWidth = Math.max(2, size * 0.008);
  const inset = size * (maskable ? 0.18 : 0.12);
  g.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  return c.toBuffer("image/png");
}
fs.writeFileSync("public/icons/icon-192.png", icon(192));
fs.writeFileSync("public/icons/icon-512.png", icon(512));
fs.writeFileSync("public/icons/icon-maskable-512.png", icon(512, { maskable: true }));
fs.writeFileSync("public/icons/apple-touch-icon.png", icon(180));
console.log("icons written");
