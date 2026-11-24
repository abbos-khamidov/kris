import { z } from "zod";
import { shortText } from "./common";
import { BRAND_ROLES, COVER_VARIANTS, TITLE_COLORS } from "./card";

export const Settings = z.object({
  specialist: z
    .object({
      name: shortText(120).default(""),
      title: shortText(120).default("Косметолог"),
      phone: shortText(40).default(""),
      whatsapp: shortText(200).default(""),
      telegram: shortText(200).default(""),
      instagram: shortText(200).default(""),
      website: shortText(200).default(""),
    })
    .default({ name: "", title: "Косметолог", phone: "", whatsapp: "", telegram: "", instagram: "", website: "" }),
  /** Vertical branded caption on the left edge of pages (e.g. an Instagram handle). */
  sideText: shortText(80).default(""),
  /** Role -> media asset id of the current brand image. */
  brandImages: z.partialRecord(z.enum(BRAND_ROLES), z.string()).default({}),
  pdf: z
    .object({
      coverVariant: z.enum(COVER_VARIANTS).default("frame"),
      coverTitleColor: z.enum(TITLE_COLORS).default("white"),
      coverNameColor: z.enum(TITLE_COLORS).default("white"),
      buttonLabel: shortText(40).default("Связаться со мной"),
    })
    .default({ coverVariant: "frame", coverTitleColor: "white", coverNameColor: "white", buttonLabel: "Связаться со мной" }),
});
export type Settings = z.infer<typeof Settings>;

/** The URL behind the «Связаться со мной» button: first available contact. */
export function contactUrl(s: Settings["specialist"]): string {
  const clean = (v: string) => v.trim();
  if (clean(s.telegram)) {
    const t = clean(s.telegram);
    return /^https?:\/\//.test(t) ? t : `https://t.me/${t.replace(/^@/, "")}`;
  }
  if (clean(s.whatsapp)) {
    const w = clean(s.whatsapp);
    return /^https?:\/\//.test(w) ? w : `https://wa.me/${w.replace(/\D/g, "")}`;
  }
  if (clean(s.phone)) return `tel:${clean(s.phone).replace(/[^\d+]/g, "")}`;
  if (clean(s.instagram)) {
    const i = clean(s.instagram);
    return /^https?:\/\//.test(i) ? i : `https://instagram.com/${i.replace(/^@/, "")}`;
  }
  return "";
}
