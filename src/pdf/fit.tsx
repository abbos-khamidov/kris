import React from "react";
import { Document } from "@react-pdf/renderer";
import { ActivesPage, CarePage, ConclusionPage, ExtraTextPage, NutritionPage, PersonalPage, PhotosPage, ProceduresPage, ProductsPage, SkinPage, VitaminsPage } from "./pages";
import type { CardSnapshot } from "./snapshot";
import { FIT_STEPS } from "./tokens";

/**
 * Auto-fit for long texts. Each section is laid out on its own (by the real renderer, so the result is
 * exact) and gets the LARGEST type size that needs the fewest pages: ideally one. Type never shrinks
 * below the readable floor (tokens.fitSize); what still does not fit continues on the next page.
 */
export type Fit = Record<string, number>;

/** Renders a document and returns the finished PDF as a binary string (browser and Node differ). */
export type RenderToString = (doc: React.ReactElement) => Promise<string>;

export const countPdfPages = (pdf: string) => pdf.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;

interface Section {
  key: string;
  data: unknown;
  page: (s: CardSnapshot, k: number) => React.ReactElement;
}

function sections(s: CardSnapshot): Section[] {
  const c = s.card;
  return [
    { key: "personal", data: c.personal, page: (x, k) => <PersonalPage s={x} k={k} /> },
    { key: "skin", data: c.skin, page: (x, k) => <SkinPage s={x} k={k} /> },
    { key: "care", data: c.care.morning.concat(c.care.evening, c.care.notes).concat(c.care.homeCare as never), page: (x, k) => <CarePage s={x} k={k} /> },
    { key: "actives", data: c.actives, page: (x, k) => <ActivesPage s={x} k={k} /> },
    { key: "nutrition", data: c.nutrition, page: (x, k) => <NutritionPage s={x} k={k} /> },
    { key: "vitamins", data: c.vitamins, page: (x, k) => <VitaminsPage s={x} k={k} /> },
    { key: "products", data: c.products, page: (x, k) => <ProductsPage s={x} k={k} /> },
    { key: "procedures", data: c.procedures, page: (x, k) => <ProceduresPage s={x} k={k} /> },
    { key: "conclusion", data: c.conclusion, page: (x, k) => <ConclusionPage s={x} k={k} /> },
    ...c.extraPages.map((p, i): Section => ({
      key: `extra:${p.id}`,
      data: p,
      page: (x, k) => (p.kind === "photos" ? <PhotosPage s={x} index={i} k={k} /> : <ExtraTextPage s={x} index={i} k={k} />),
    })),
  ];
}

/** Sections with this little content always fit, so they are not measured. */
const SHORT = 600;

/** Live preview re-renders often; unchanged sections are not measured again. */
const cache = new Map<string, number>();

export async function computeFit(s: CardSnapshot, render: RenderToString): Promise<Fit> {
  // Brand pictures have fixed frames, so measuring without them gives the same layout, only faster.
  const light: CardSnapshot = { ...s, brand: {} };
  const fit: Fit = {};
  for (const section of sections(s)) {
    const json = JSON.stringify(section.data);
    if (json.length < SHORT) continue;
    const key = [section.key, json, s.card.design.showSideText, s.sideText, Object.keys(s.images).join()].join("|");
    let k = cache.get(key);
    if (k === undefined) {
      const pages = async (size: number) => countPdfPages(await render(<Document>{section.page(light, size)}</Document>));
      const min = FIT_STEPS[FIT_STEPS.length - 1];
      const full = await pages(1);
      k = 1;
      if (full > 1) {
        const best = await pages(min);
        // Shrinking is pointless if it does not save a page.
        if (best < full) {
          k = min;
          for (const step of FIT_STEPS.slice(1, -1)) {
            if ((await pages(step)) === best) {
              k = step;
              break;
            }
          }
        }
      }
      if (cache.size > 200) cache.clear();
      cache.set(key, k);
    }
    if (k !== 1) fit[section.key] = k;
  }
  return fit;
}
