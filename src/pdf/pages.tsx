import React from "react";
import { Link, Page, Svg, Line, Circle, Text, View } from "@react-pdf/renderer";
import { HOME_CARE_LABEL, productLine, type ProductItem } from "@/lib/schemas/card";
import { formatPrice } from "@/lib/format";
import { COLOR, FONT, GEO, PAGE, SIZE, fitSize as f, keepTogether } from "./tokens";
import {
  Blocks,
  Box,
  CardShell,
  Background,
  FaceDiagram,
  Img,
  Legend,
  PageTitle,
  RadioDot,
  Rich,
  SideText,
  StdPage,
  splitForFloat,
} from "./primitives";
import type { CardSnapshot, ImageSrc } from "./snapshot";

const SIDE = (s: CardSnapshot, color: string) => (s.card.design.showSideText && s.sideText ? { text: s.sideText, color } : undefined);
const FULL: Box = { left: GEO.marginX, top: GEO.cardTop, bottom: GEO.cardBottom, width: PAGE.w - GEO.marginX * 2 };
const bodyAt = (k = 1) => ({ fontFamily: FONT.sans, fontSize: f(SIZE.body, k), lineHeight: 1.42, color: COLOR.text }) as const;
/** `k` is the auto-fit factor of a section (1 = reference size). */
type PageProps = { s: CardSnapshot; k?: number };

const imgOf = (s: CardSnapshot, key: string): ImageSrc | undefined => {
  const over = s.card.design.imageOverrides[key];
  return (over && s.images[over]) || (s.brand as Record<string, ImageSrc | undefined>)[key];
};

/* ================================================================ 1. cover */

const COVER_COLOR = { white: COLOR.white, burgundy: COLOR.burgundy, dark: "#1A1A1A" } as const;

/** Long names wrap onto several lines and shrink in steps — never below a readable size. */
export function coverNameSize(name: string, base: number): number {
  const n = name.trim().length;
  if (n <= 18) return base;
  if (n <= 28) return Math.round(base * 0.82);
  if (n <= 40) return Math.round(base * 0.68);
  return Math.max(26, Math.round(base * 0.58));
}

export function CoverPage({ s }: { s: CardSnapshot }) {
  const d = s.card.design;
  const titleColor = COVER_COLOR[d.coverTitleColor];
  const nameColor = COVER_COLOR[d.coverNameColor];
  const name = s.card.personal.fullName.trim() || s.patient.fullName;
  const variant = d.coverVariant;
  const title = d.coverTitle || "КАРТА ПАЦИЕНТА";
  const words = title.split(/\s+/);
  const nameBase = variant === "burgundy-top" ? 56 : SIZE.coverName;
  const nameSize = coverNameSize(name, nameBase);

  const titleBlock = (
    <View style={{ width: 460 }}>
      {words.map((w, i) => (
        <Text key={i} style={{ fontFamily: FONT.serif, fontSize: SIZE.coverTitle, lineHeight: 1.2, color: titleColor }}>
          {w}
        </Text>
      ))}
    </View>
  );

  const nameEl = (lineHeight: number) => (
    <Text style={{ fontFamily: FONT.serif, fontSize: nameSize, lineHeight, color: nameColor }}>{name}</Text>
  );

  return (
    <Page size={[PAGE.w, PAGE.h]} style={{ backgroundColor: COLOR.milk }}>
      <Img src={imgOf(s, "cover")} style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h }} />
      {variant === "frame" && (
        <>
          <View
            style={{
              position: "absolute",
              left: 29,
              top: -45,
              width: 478,
              height: 228,
              borderRadius: 40,
              borderWidth: 1.4,
              borderColor: COLOR.white,
            }}
          />
          <View style={{ position: "absolute", left: 433, top: 193, width: 200, height: 28, borderWidth: 1.2, borderColor: COLOR.white }} />
          <View style={{ position: "absolute", left: 69, top: 18 }}>{titleBlock}</View>
          <View style={{ position: "absolute", left: 69, bottom: 46, width: 470 }}>{nameEl(1.2)}</View>
        </>
      )}
      {variant === "burgundy-bottom" && (
        // Title + name are one bottom-anchored stack: a long, wrapped name grows upwards, never off the page.
        <View style={{ position: "absolute", left: 69, bottom: 46, width: 470 }}>
          {titleBlock}
          <View style={{ marginTop: 16 }}>{nameEl(1.2)}</View>
        </View>
      )}
      {variant === "burgundy-top" && (
        <>
          <View style={{ position: "absolute", left: 50, top: 18 }}>{titleBlock}</View>
          <View style={{ position: "absolute", left: 50, bottom: 46, width: 490 }}>{nameEl(1.12)}</View>
        </>
      )}
    </Page>
  );
}

/* ================================================================ 2. personal */

function Row({ label, children, k = 1 }: { label: string; children?: React.ReactNode; k?: number }) {
  return (
    <View wrap={!keepTogether(label)} style={{ flexDirection: "row", alignItems: "center", minHeight: 40 * k, borderBottomWidth: 0.6, borderBottomColor: COLOR.line, marginBottom: 5 * k }}>
      <Text style={{ ...bodyAt(k), marginRight: 6, ...(children ? {} : { flex: 1, paddingVertical: 3 * k }) }}>{label}</Text>
      {children}
    </View>
  );
}

function RadioPair({ a, b, on, k = 1 }: { a: string; b: string; on: "a" | "b" | null; k?: number }) {
  const bodyText = bodyAt(k);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", width: 150 }}>
        <RadioDot on={on === "a"} size={15} />
        <Text style={{ ...bodyText, marginLeft: 8 }}>{a}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <RadioDot on={on === "b"} size={15} />
        <Text style={{ ...bodyText, marginLeft: 8 }}>{b}</Text>
      </View>
    </View>
  );
}

const triText = (state: string, detail: string, emptyYes = "") => {
  if (detail.trim()) return detail.trim();
  if (state === "no") return "нет";
  if (state === "yes") return emptyYes || "да";
  if (state === "unknown") return "неизвестно";
  return "";
};

const SEBUM_LABELS = [
  ["Себостатическая", "(себодефицитная)"],
  ["Скорее себостатическая", "умеренно", "(склонна к сухости)"],
  ["Кожа с нормальным", "(умеренным) типом", "сальной секреции"],
  ["Скорее себорейная", "умеренно (склонна", "к жирности)"],
  ["Себорейная"],
];

function SebumScale({ value }: { value: number | null }) {
  const W = 480;
  const x = (n: number) => 7 + ((n - 1) / 4) * (W - 14);
  return (
    <View wrap={false} style={{ marginTop: 6 }}>
      <Svg viewBox={`0 0 ${W} 18`} style={{ width: W, height: 18 }}>
        {[1, 2, 3, 4].map((n) => (
          <Line key={n} x1={x(n) + 7} y1="9" x2={x(n + 1) - 7} y2="9" stroke={COLOR.burgundy} strokeWidth="1.4" opacity={0.25 + n * 0.18} />
        ))}
        {[1, 2, 3, 4, 5].map((n) => (
          <Circle key={n} cx={x(n)} cy="9" r="6" stroke={COLOR.burgundy} strokeWidth="1.2" fill={COLOR.white} />
        ))}
        {value !== null && <Circle cx={x(value)} cy="9" r="6" fill={COLOR.burgundy} />}
      </Svg>
      <View style={{ flexDirection: "row", marginTop: 3 }}>
        {SEBUM_LABELS.map((lines, i) => (
          <View key={i} style={{ width: (W - 14) / 4, paddingRight: 4 }}>
            <Text style={{ fontFamily: FONT.sans, fontWeight: 500, fontSize: 13, marginBottom: 3 }}>{i + 1}</Text>
            {lines.map((l) => (
              <Text key={l} style={{ fontFamily: FONT.sans, fontSize: 8.5, lineHeight: 1.25 }}>
                {l}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const CYCLE_TEXT: Record<string, string> = { regular: "регулярный", irregular: "нерегулярный", unknown: "неизвестно", unspecified: "" };

export function PersonalPage({ s, k = 1 }: PageProps) {
  const bodyText = bodyAt(k);
  const p = s.card.personal;
  const name = p.fullName.trim() || s.patient.fullName;
  const sebumText = p.sebumText.trim() || (p.sebum !== null ? String(p.sebum).replace(".", ",") : "");
  const radio = (state: string): "a" | "b" | null => (state === "yes" ? "a" : state === "no" ? "b" : null);
  return (
    <StdPage title="ЛИЧНЫЕ ДАННЫЕ" titleColor={COLOR.burgundy} bg="milk" box={FULL} side={SIDE(s, COLOR.burgundy)}>
      <Row k={k} label="ФИО:">
        <Text style={{ fontFamily: FONT.serif, fontSize: name.length > 34 ? 17 : name.length > 24 ? 20 : 24, color: COLOR.burgundy, flex: 1 }}>{name}</Text>
      </Row>
      <Row k={k} label={`Возраст: ${p.ageText}`} />
      <Row k={k} label={`Аллергии: ${triText(p.allergiesState, p.allergies)}`} />
      <Row k={k} label={`Хронические заболевания: ${triText(p.chronicState, p.chronic, "есть")}`} />
      <Row k={k} label={`Состояние щитовидной железы: ${triText(p.thyroidState, p.thyroid)}`} />
      <Row k={k} label="Анализы на гормоны:">
        {p.hormoneTests === "yes" || p.hormoneTests === "no" ? (
          <RadioPair k={k} a="Да" b="Нет" on={radio(p.hormoneTests)} />
        ) : (
          <Text style={bodyText}>{p.hormoneTests === "unknown" ? "неизвестно" : ""}</Text>
        )}
        {p.hormoneTestsNote ? <Text style={{ ...bodyText, flex: 1, fontSize: f(11, k), color: COLOR.textSoft }}> {p.hormoneTestsNote}</Text> : null}
      </Row>
      <Row k={k} label="Цикл:">
        {p.cycle === "regular" || p.cycle === "irregular" ? (
          <RadioPair k={k} a="Регулярный" b="Нерегулярный" on={p.cycle === "regular" ? "a" : "b"} />
        ) : (
          <Text style={bodyText}>{CYCLE_TEXT[p.cycle]}</Text>
        )}
      </Row>
      <Row k={k} label="Беременность:">
        {p.pregnancy === "yes" || p.pregnancy === "no" ? (
          <RadioPair k={k} a="Да" b="Нет" on={radio(p.pregnancy)} />
        ) : (
          <Text style={bodyText}>{p.pregnancy === "planning" ? "планирование" : p.pregnancy === "unknown" ? "неизвестно" : ""}</Text>
        )}
      </Row>
      <Row k={k} label="Лактация:">
        {p.lactation === "yes" || p.lactation === "no" ? (
          <RadioPair k={k} a="Да" b="Нет" on={radio(p.lactation)} />
        ) : (
          <Text style={bodyText}>{p.lactation === "unknown" ? "неизвестно" : ""}</Text>
        )}
      </Row>
      {p.custom
        .filter((x) => x.label.trim() || x.value.trim())
        .map((x) => (
          <Row k={k} key={x.id} label={`${x.label}: ${x.value}`} />
        ))}
      <Row k={k} label={`Тип себосекреции: ${sebumText}`} />
      <SebumScale value={p.sebum} />
    </StdPage>
  );
}

/* ================================================================ 3. skin */

export function SkinPage({ s, k = 1 }: PageProps) {
  const photos = s.card.skin.photoIds.map((id) => s.images[id]).filter(Boolean);
  return (
    <StdPage title="СОСТОЯНИЕ КОЖИ" titleColor={COLOR.white} bg="products" bgSrc={imgOf(s, "bg_products")} box={FULL}>
      <Blocks blocks={s.card.skin.blocks} size={f(SIZE.body, k)} images={s.images} />
      {photos.length > 0 && (
        <View wrap={false} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {photos.map((p, i) => (
            <Img key={i} src={p} style={{ width: 150, height: 180, borderRadius: 14 }} />
          ))}
        </View>
      )}
    </StdPage>
  );
}

/* ================================================================ 4. care */

const FACE = 188;

export function CarePage({ s, k = 1 }: PageProps) {
  const bodyText = bodyAt(k);
  const size = f(SIZE.body, k);
  const face = Math.round(FACE * Math.max(0.8, k));
  const c = s.card.care;
  const colW = PAGE.w - GEO.marginX * 2 - GEO.cardPadX * 2 - face - 16;
  const split = splitForFloat(c.morning, colW, face + 20, size);
  const home = c.homeCare.filter((h) => h.name.trim());
  return (
    <StdPage title="СХЕМА УХОДА" titleColor={COLOR.white} bg="room" bgSrc={imgOf(s, "bg_room")} box={FULL}>
      <Text style={{ fontFamily: FONT.serif, fontSize: f(24, k), marginBottom: 8 }}>{c.morningTitle}</Text>
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Blocks blocks={split.beside} size={size} images={s.images} />
        </View>
        <View style={{ width: face }}>
          <FaceDiagram src={imgOf(s, "face_illustration")} strokes={c.face.strokes} size={face} />
          <Legend />
        </View>
      </View>
      <Blocks blocks={split.below} size={size} images={s.images} />
      <Text minPresenceAhead={60} style={{ fontFamily: FONT.serif, fontSize: f(24, k), marginTop: 10 * k, marginBottom: 8 * k }}>
        {c.eveningTitle}
      </Text>
      <Blocks blocks={c.evening} size={size} images={s.images} />
      <Blocks blocks={c.notes} size={size} images={s.images} />
      {home.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text minPresenceAhead={60} style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginBottom: 6 }}>
            Текущий домашний уход
          </Text>
          {home.map((h) => (
            <View key={h.id} wrap={!keepTogether(h.name, h.note)} style={{ flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: COLOR.line, paddingVertical: 4 * k }}>
              <Text style={{ ...bodyText, flex: 1 }}>{h.name}</Text>
              <Text style={{ ...bodyText, width: 110, color: COLOR.burgundy, fontWeight: 600 }}>{HOME_CARE_LABEL[h.decision]}</Text>
              {h.note ? <Text style={{ ...bodyText, flex: 1, fontSize: f(12, k), color: COLOR.textSoft }}>{h.note}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </StdPage>
  );
}

/* ================================================================ 5-7 milk pages with a photo on the right */

const SIDE_BOX: Box = { left: GEO.marginX, top: GEO.cardTop, bottom: GEO.cardBottom, width: 450 };

function SidePhoto({ src, top, height, left = 300, label }: { src?: ImageSrc; top: number; height: number; left?: number; label?: string }) {
  return (
    <View fixed style={{ position: "absolute", left, top, width: PAGE.w - left + 30, height }}>
      <Img src={src} style={{ width: PAGE.w - left + 30, height, borderRadius: 30 }} />
      {label ? (
        <Text style={{ position: "absolute", right: 60, top: 12, fontFamily: FONT.sans, fontSize: 9, color: COLOR.white }}>{label}</Text>
      ) : null}
    </View>
  );
}

export function ActivesPage({ s, k = 1 }: PageProps) {
  const size = f(SIZE.body, k);
  const a = s.card.actives;
  const label = s.card.design.showSideText ? s.sideText : "";
  return (
    <StdPage
      title="АКТИВЫ/ЛЕЧЕБНЫЕ СРЕДСТВА"
      titleColor={COLOR.burgundy}
      bg="milk"
      box={SIDE_BOX}
      behind={
        <>
          <SidePhoto src={imgOf(s, "side_actives_top")} top={93} height={290} label={label} />
          <SidePhoto src={imgOf(s, "side_actives_bottom")} top={425} left={312} height={370} />
        </>
      }
    >
      <Blocks blocks={a.blocks} size={size} images={s.images} />
      {a.note.length > 0 && (
        <>
          <Text minPresenceAhead={50} style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginTop: 6, marginBottom: 6 }}>
            {a.noteTitle}
          </Text>
          <Blocks blocks={a.note} size={size} images={s.images} />
        </>
      )}
    </StdPage>
  );
}

export function NutritionPage({ s, k = 1 }: PageProps) {
  const size = f(SIZE.body, k);
  const n = s.card.nutrition;
  const label = s.card.design.showSideText ? s.sideText : "";
  return (
    <StdPage
      title="ПИТАНИЕ"
      titleColor={COLOR.burgundy}
      bg="milk"
      box={SIDE_BOX}
      behind={<SidePhoto src={imgOf(s, "side_nutrition")} top={93} height={700} label={label} />}
    >
      <Text style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginBottom: 8 * k }}>{n.mainTitle}</Text>
      <Blocks blocks={n.main} size={size} images={s.images} />
      {n.extra.length > 0 && (
        <>
          <Text minPresenceAhead={50} style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginTop: 6 * k, marginBottom: 8 * k }}>
            {n.extraTitle}
          </Text>
          <Blocks blocks={n.extra} size={size} images={s.images} />
        </>
      )}
    </StdPage>
  );
}

export function VitaminsPage({ s, k = 1 }: PageProps) {
  const size = f(SIZE.body, k);
  const v = s.card.vitamins;
  const label = s.card.design.showSideText ? s.sideText : "";
  return (
    <StdPage
      title="ВИТАМИНЫ И АНАЛИЗЫ"
      titleColor={COLOR.burgundy}
      bg="milk"
      box={SIDE_BOX}
      behind={<SidePhoto src={imgOf(s, "side_vitamins")} top={93} height={700} label={label} />}
    >
      <Text style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginBottom: 8 * k }}>{v.supplementsTitle}</Text>
      <Blocks blocks={v.supplements} size={size} images={s.images} />
      {v.tests.length > 0 && (
        <>
          <Text minPresenceAhead={50} style={{ fontFamily: FONT.serif, fontSize: f(18, k), marginTop: 8 * k, marginBottom: 8 * k }}>
            {v.testsTitle}
          </Text>
          <Blocks blocks={v.tests} size={size} images={s.images} />
        </>
      )}
    </StdPage>
  );
}

/* ================================================================ 8. products */

function PriceCell({ item, k }: { item: ProductItem; k: number }) {
  const lines = item.variants
    .map((v) => ({ vol: v.volume.trim(), price: formatPrice(v.price) }))
    .filter((v) => v.price || v.vol);
  return (
    <View style={{ minWidth: 92, maxWidth: 170, marginLeft: 10, alignItems: "flex-end" }}>
      {lines.map((l, i) => (
        <Text key={i} style={{ fontFamily: FONT.sans, fontSize: f(lines.length > 1 ? 13 : 16, k), color: COLOR.burgundy, textAlign: "right", lineHeight: 1.3 }}>
          {l.vol && lines.length > 1 ? `${l.vol} — ` : ""}
          {l.price}
        </Text>
      ))}
    </View>
  );
}

export function ProductsPage({ s, k = 1 }: PageProps) {
  const items = s.card.products.items;
  return (
    <StdPage title="РЕКОМЕНДОВАННЫЕ СРЕДСТВА" titleColor={COLOR.white} bg="room" bgSrc={imgOf(s, "bg_room")} box={FULL} side={SIDE(s, COLOR.burgundy)}>
      {items.map((it, i) => {
        const line = productLine(it);
        const vols = it.variants.length === 1 && it.variants[0].volume.trim() ? `, ${it.variants[0].volume.trim()}` : "";
        return (
          <View key={it.id} wrap={!keepTogether(it.label, line, it.note)} style={{ borderBottomWidth: 0.6, borderBottomColor: COLOR.line, paddingVertical: 8 * k }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontFamily: FONT.sans, fontSize: f(15, k), width: 26, color: COLOR.burgundy }}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                {it.label ? <Text style={{ fontFamily: FONT.sans, fontSize: f(15, k), color: COLOR.burgundy, marginBottom: 2 }}>{it.label}</Text> : null}
                {it.url ? (
                  <Link src={it.url} style={{ textDecoration: "none" }}>
                    <Text style={{ fontFamily: FONT.sans, fontSize: f(14, k), lineHeight: 1.35, color: COLOR.burgundy }}>
                      {it.isAlternative ? "или " : ""}
                      {line}
                      {vols}
                    </Text>
                  </Link>
                ) : (
                  <Text style={{ fontFamily: FONT.sans, fontSize: f(14, k), lineHeight: 1.35, color: COLOR.burgundy }}>
                    {it.isAlternative ? "или " : ""}
                    {line}
                    {vols}
                  </Text>
                )}
                {it.note ? <Text style={{ fontFamily: FONT.sans, fontSize: f(10.5, k), color: COLOR.textSoft, marginTop: 2 }}>{it.note}</Text> : null}
              </View>
              <PriceCell item={it} k={k} />
            </View>
          </View>
        );
      })}
      {s.card.products.footnote.trim() && (
        <Text style={{ fontFamily: FONT.sans, fontSize: f(SIZE.small, k), lineHeight: 1.35, marginTop: 14 * k }}>{s.card.products.footnote}</Text>
      )}
    </StdPage>
  );
}

/* ================================================================ 9. procedures */

const cell = { backgroundColor: COLOR.white, borderRadius: GEO.rowRadius } as const;

export function ProceduresPage({ s, k = 1 }: PageProps) {
  const plans = s.card.procedures.plans;
  const multi = plans.length > 1;
  return (
    <Page
      size={[PAGE.w, PAGE.h]}
      wrap
      style={{ paddingTop: 100, paddingBottom: 30, paddingLeft: 31, paddingRight: 31, fontFamily: FONT.sans }}
    >
      <Background bg="products" src={imgOf(s, "bg_products")} />
      <SideText text={s.card.design.showSideText ? s.sideText : ""} color={COLOR.white} />
      <PageTitle title="ПЛАН ПРОЦЕДУР" color={COLOR.white} />
      {plans.map((plan) => (
        <View key={plan.id}>
          {multi && (
            <Text minPresenceAhead={80} style={{ fontFamily: FONT.serif, fontSize: f(18, k), color: COLOR.white, marginTop: 8 * k, marginBottom: 8 * k }}>
              {plan.title}
            </Text>
          )}
          {plan.items.map((it, i) => {
            const meta = [
              it.sessions && `Курс: ${it.sessions}`,
              it.frequency && `Периодичность: ${it.frequency}`,
              it.dosage && `Дозировка: ${it.dosage}`,
              it.volume && `Объём: ${it.volume}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <View key={it.id} wrap={!keepTogether(it.name, it.description, meta)} style={{ flexDirection: "row", marginBottom: GEO.rowGap * k, alignItems: "stretch" }}>
                <View style={{ ...cell, width: 84, minHeight: 54 * k, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: FONT.sans, fontSize: f(16, k), color: COLOR.burgundy }}>{i + 1}</Text>
                </View>
                <View style={{ ...cell, flex: 1, marginHorizontal: 10, paddingVertical: 9 * k, paddingHorizontal: 14, justifyContent: "center" }}>
                  <Text style={{ fontFamily: FONT.sans, fontSize: f(14, k), lineHeight: 1.35 }}>
                    {it.isAlternative ? "или " : ""}
                    {it.name}
                  </Text>
                  {it.description ? <Text style={{ fontFamily: FONT.sans, fontSize: f(12, k), lineHeight: 1.35, color: COLOR.textSoft, marginTop: 2 }}>{it.description}</Text> : null}
                  {meta ? <Text style={{ fontFamily: FONT.sans, fontSize: f(10.5, k), color: COLOR.textSoft, marginTop: 3 }}>{meta}</Text> : null}
                </View>
                <View style={{ ...cell, width: 128, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: FONT.sans, fontSize: f(14, k), color: COLOR.burgundy, textAlign: "center", lineHeight: 1.3 }}>{formatPrice(it.price)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Page>
  );
}

/* ================================================================ 10. conclusion */

const CONCL_BOX: Box = { left: GEO.marginX, top: 93, bottom: 183, width: PAGE.w - GEO.marginX * 2 };
const PHOTO_W = 250;
const PHOTO_H = 311;

export function ConclusionPage({ s, k = 1 }: PageProps) {
  const size = f(14, k);
  const blocks = s.card.conclusion.blocks;
  const textW = CONCL_BOX.width - GEO.cardPadX * 2 - PHOTO_W - 16;
  const split = splitForFloat(blocks, textW, PHOTO_H - 10, size);
  const label = s.card.conclusion.buttonLabel || "Связаться со мной";
  const button = (
    <View style={{ width: "100%", height: "100%", borderRadius: 8, backgroundColor: COLOR.burgundy, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: FONT.serif, fontSize: SIZE.button, color: COLOR.white }}>{label}</Text>
    </View>
  );
  const buttonBox = { position: "absolute", left: 29, top: 669, width: PAGE.w - 58, height: 62 } as const;
  return (
    <StdPage
      title="ЗАКЛЮЧЕНИЕ"
      titleColor={COLOR.burgundy}
      bg="milk"
      box={CONCL_BOX}
      side={SIDE(s, COLOR.burgundy)}
      front={
        s.contactUrl ? (
          <Link src={s.contactUrl} fixed style={{ ...buttonBox, textDecoration: "none" }}>
            {button}
          </Link>
        ) : (
          <View fixed style={buttonBox}>
            {button}
          </View>
        )
      }
    >
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1, paddingRight: 16, minHeight: PHOTO_H }}>
          <Blocks blocks={split.beside} images={s.images} size={size} />
        </View>
        <View style={{ width: PHOTO_W, marginTop: -GEO.cardPadTop + 0 }} wrap={false}>
          <Img src={imgOf(s, "specialist")} style={{ width: PHOTO_W, height: PHOTO_H, borderRadius: 30 }} />
          {s.sideText && s.card.design.showSideText ? (
            <Text style={{ position: "absolute", left: 12, bottom: 14, fontFamily: FONT.sans, fontSize: 11, color: COLOR.white }}>{s.sideText}</Text>
          ) : null}
        </View>
      </View>
      <Blocks blocks={split.below} images={s.images} size={size} />
    </StdPage>
  );
}

/* ================================================================ extra pages */

export function ExtraTextPage({ s, index, k = 1 }: PageProps & { index: number }) {
  const p = s.card.extraPages[index];
  return (
    <StdPage title={p.title.toUpperCase()} titleColor={COLOR.white} bg="room" bgSrc={imgOf(s, "bg_room")} box={FULL}>
      <Blocks blocks={p.blocks} size={f(SIZE.body, k)} images={s.images} />
    </StdPage>
  );
}

export function PhotosPage({ s, index, k = 1 }: PageProps & { index: number }) {
  const p = s.card.extraPages[index];
  const photos = p.photoIds.map((id) => ({ id, src: s.images[id] })).filter((x) => x.src);
  return (
    <StdPage title={(p.title || "Фотографии и динамика").toUpperCase()} titleColor={COLOR.white} bg="room" bgSrc={imgOf(s, "bg_room")} box={FULL}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {photos.map((ph) => (
          <View key={ph.id} wrap={false} style={{ width: 246 }}>
            <Img src={ph.src} style={{ width: 246, height: 300, borderRadius: 16 }} />
          </View>
        ))}
      </View>
      <Blocks blocks={p.blocks} size={f(SIZE.body, k)} images={s.images} />
    </StdPage>
  );
}

export { CardShell, Rich };
