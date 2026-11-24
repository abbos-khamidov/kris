// Dev check: runs the import parser on every PDF in references/ and prints a SUMMARY only
// (counts and a few product names). Nothing is stored or printed that identifies a patient.
// Usage: npx tsx scripts/import-dry-run.ts
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPages } from "../src/lib/import/extract";
import { parseCard } from "../src/lib/import/parse";

async function main() {
  const dir = path.resolve("references");
  for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith(".pdf"))) {
    const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, f))) }).promise;
    const r = parseCard(await extractPages(doc as never));
    const counts = Object.fromEntries(Object.entries(r.sections).map(([k, v]) => [k, v?.length ?? 0]));
    console.log(f, {
      pages: r.pages,
      patientNameFound: r.patient.fullName.length > 0,
      paragraphs: counts,
      products: r.products.length,
      procedures: r.procedures.length,
      unrecognised: r.unrecognised,
    });
    console.log("  product samples:", r.products.slice(0, 3).map((p) => `${p.isAlternative ? "или " : ""}${p.name} | ${p.price}`));
    console.log("  procedure samples:", r.procedures.slice(0, 2).map((p) => `${p.name.slice(0, 40)} | ${p.price}`));
  }
}
main();
