import type { PageItems } from "./parse";

/** Minimal slice of the pdf.js API, so the same code runs in the browser and in Node scripts/tests. */
interface PdfPageLike {
  view: number[];
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

/** Text items with positions; y is the BASELINE measured from the page top (what parseCard expects). */
export async function extractPages(doc: PdfDocLike): Promise<PageItems[]> {
  const pages: PageItems[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const height = page.view[3] - page.view[1];
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[] }[])
      .filter((i) => typeof i.str === "string" && i.str.trim() && i.transform)
      .map((i) => ({
        str: i.str as string,
        x: i.transform![4],
        y: height - i.transform![5],
        size: Math.hypot(i.transform![2], i.transform![3]),
      }));
    pages.push({ items });
  }
  return pages;
}
