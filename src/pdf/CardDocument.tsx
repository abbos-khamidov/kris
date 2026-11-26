import React from "react";
import { Document } from "@react-pdf/renderer";
import {
  ActivesPage,
  CarePage,
  ConclusionPage,
  CoverPage,
  ExtraTextPage,
  NutritionPage,
  PersonalPage,
  PhotosPage,
  ProceduresPage,
  ProductsPage,
  SkinPage,
  VitaminsPage,
} from "./pages";
import type { Fit } from "./fit";
import type { CardSnapshot } from "./snapshot";

/**
 * THE document. Preview, download, share and the stored approved PDF all render this component
 * from one CardSnapshot. Ten standard pages in fixed order, then optional extra pages;
 * long text is first shrunk to fit (`fit`, see fit.tsx), the rest continues on extra pages in the same style.
 */
export function CardDocument({ snapshot: s, fit = {} }: { snapshot: CardSnapshot; fit?: Fit }) {
  const name = s.card.personal.fullName || s.patient.fullName;
  return (
    <Document title={`Карта пациента — ${name}`} author={s.specialist.name || "KRIS SKIN"} creator="KRIS SKIN" producer="KRIS SKIN" language="ru-RU">
      <CoverPage s={s} />
      <PersonalPage s={s} k={fit.personal} />
      <SkinPage s={s} k={fit.skin} />
      <CarePage s={s} k={fit.care} />
      <ActivesPage s={s} k={fit.actives} />
      <NutritionPage s={s} k={fit.nutrition} />
      <VitaminsPage s={s} k={fit.vitamins} />
      <ProductsPage s={s} k={fit.products} />
      <ProceduresPage s={s} k={fit.procedures} />
      <ConclusionPage s={s} k={fit.conclusion} />
      {s.card.extraPages.map((p, i) =>
        p.kind === "photos" ? (
          <PhotosPage key={p.id} s={s} index={i} k={fit[`extra:${p.id}`]} />
        ) : (
          <ExtraTextPage key={p.id} s={s} index={i} k={fit[`extra:${p.id}`]} />
        ),
      )}
    </Document>
  );
}
