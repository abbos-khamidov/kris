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
import type { CardSnapshot } from "./snapshot";

/**
 * THE document. Preview, download, share and the stored approved PDF all render this component
 * from one CardSnapshot. Ten standard pages in fixed order, then optional extra pages;
 * overflowing content continues on extra pages in the same style.
 */
export function CardDocument({ snapshot: s }: { snapshot: CardSnapshot }) {
  const name = s.card.personal.fullName || s.patient.fullName;
  return (
    <Document title={`Карта пациента — ${name}`} author={s.specialist.name || "KRIS SKIN"} creator="KRIS SKIN" producer="KRIS SKIN" language="ru-RU">
      <CoverPage s={s} />
      <PersonalPage s={s} />
      <SkinPage s={s} />
      <CarePage s={s} />
      <ActivesPage s={s} />
      <NutritionPage s={s} />
      <VitaminsPage s={s} />
      <ProductsPage s={s} />
      <ProceduresPage s={s} />
      <ConclusionPage s={s} />
      {s.card.extraPages.map((p, i) =>
        p.kind === "photos" ? <PhotosPage key={p.id} s={s} index={i} /> : <ExtraTextPage key={p.id} s={s} index={i} />,
      )}
    </Document>
  );
}
