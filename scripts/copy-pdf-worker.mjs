// postinstall: serve the pdf.js worker from /public (same-origin, version-locked to node_modules).
import fs from "node:fs";
const src = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (fs.existsSync(src)) {
  fs.copyFileSync(src, "public/pdf.worker.min.mjs");
  console.log("copied pdf.worker.min.mjs to public/");
}
