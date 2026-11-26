import React from "react";
import { Image, Link, Page, Svg, Line, Circle, Polyline, Text, View } from "@react-pdf/renderer";
type Style = import("@react-pdf/renderer").Styles[string];
import type { Block, Stroke } from "@/lib/schemas/card";
import { COLOR, FONT, GEO, PAGE, SIZE, keepTogether } from "./tokens";
import { parseInline } from "./inline";
import type { ImageSrc } from "./snapshot";

/* ---------------------------------------------------------------- images */

/** Missing images render as an empty neutral box instead of failing the whole document. */
export function Img({ src, style }: { src?: ImageSrc; style: Style }) {
  if (!src) return <View style={{ backgroundColor: "#E2DAD4", ...style }} />;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={src as never} style={{ objectFit: "cover", ...style }} />;
}

/* ---------------------------------------------------------------- inline text */

export function Rich({ text, style }: { text: string; style?: Style }) {
  return (
    <Text style={style}>
      {parseInline(text).map((r, i) => (
        <Text
          key={i}
          style={
            r.style === "bold"
              ? { fontWeight: 700 }
              : r.style === "accent"
                ? { color: COLOR.burgundy, fontWeight: 600 }
                : r.style === "warn"
                  ? { color: COLOR.warn, fontWeight: 700 }
                  : {}
          }
        >
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

/* ---------------------------------------------------------------- blocks */

const bodyStyle = (size: number): Style => ({ fontFamily: FONT.sans, fontSize: size, lineHeight: 1.42, color: COLOR.text });

export function BlockView({
  block,
  size = SIZE.body,
  images,
}: {
  block: Block;
  size?: number;
  images: Record<string, ImageSrc>;
}) {
  const body = bodyStyle(size);
  switch (block.type) {
    case "h":
      return (
        <Text minPresenceAhead={40} style={{ fontFamily: FONT.serif, fontSize: size + 3, color: COLOR.text, marginTop: 6, marginBottom: 6 }}>
          {block.text}
        </Text>
      );
    case "p":
      return block.text.trim() ? <Rich text={block.text} style={{ ...body, marginBottom: size * 0.55 }} /> : null;
    case "ul":
    case "ol":
      return (
        <View style={{ marginBottom: size * 0.55 }}>
          {block.items
            .filter((t) => t.trim())
            .map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: size * 0.2 }} wrap={!keepTogether(t)}>
                <Text style={{ ...body, width: size * 1.7, flexShrink: 0 }}>{block.type === "ol" ? `${i + 1}.` : "•"}</Text>
                <Rich text={t} style={{ ...body, flex: 1 }} />
              </View>
            ))}
        </View>
      );
    case "table":
      return (
        <View style={{ marginBottom: size * 0.7, borderTopWidth: 0.6, borderTopColor: COLOR.line }}>
          {block.title ? <Text style={{ ...body, fontWeight: 700, marginBottom: 4 }}>{block.title}</Text> : null}
          {block.rows.map((row, ri) => (
            <View key={ri} wrap={!keepTogether(...row)} style={{ flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: COLOR.line }}>
              {row.map((cell, ci) => (
                <Text
                  key={ci}
                  style={{
                    ...body,
                    flex: 1,
                    paddingVertical: 4,
                    paddingRight: 6,
                    fontWeight: block.header && ri === 0 ? 700 : 400,
                  }}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "img": {
      const src = block.assetId ? images[block.assetId] : undefined;
      return src ? (
        <View wrap={false} style={{ marginBottom: size * 0.6 }}>
          <Img src={src} style={{ width: "100%", maxHeight: (260 * size) / SIZE.body, borderRadius: 14, objectFit: "contain" }} />
          {block.caption ? <Text style={{ ...body, fontSize: size - 3, color: COLOR.muted, marginTop: 3 }}>{block.caption}</Text> : null}
        </View>
      ) : null;
    }
    case "note":
      return block.text.trim() ? (
        <View
          wrap={!keepTogether(block.title, block.text)}
          style={{
            marginBottom: size * 0.6,
            padding: 10,
            borderLeftWidth: 3,
            borderLeftColor: COLOR.burgundy,
            backgroundColor: COLOR.milk,
            borderRadius: 6,
          }}
        >
          {block.title ? <Text style={{ ...body, fontFamily: FONT.serif, fontSize: size + 1, marginBottom: 3 }}>{block.title}</Text> : null}
          <Rich text={block.text} style={body} />
        </View>
      ) : null;
    case "custom":
      return block.text.trim() || block.title ? (
        <View style={{ marginBottom: size * 0.6 }}>
          {block.title ? (
            <Text minPresenceAhead={40} style={{ fontFamily: FONT.serif, fontSize: size + 3, marginBottom: 4 }}>
              {block.title}
            </Text>
          ) : null}
          <Rich text={block.text} style={body} />
        </View>
      ) : null;
  }
}

export function Blocks({ blocks, size, images }: { blocks: Block[]; size?: number; images: Record<string, ImageSrc> }) {
  return (
    <View>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} size={size} images={images} />
      ))}
    </View>
  );
}

/**
 * Rough height estimate of blocks in a column (used to decide how many blocks sit beside a floating
 * image). Only affects layout balance — never overlap: text can't run under an image either way.
 */
export function estimateHeight(blocks: Block[], colWidth: number, size: number = SIZE.body): number {
  const cpl = Math.max(8, Math.floor(colWidth / (size * 0.56)));
  const line = size * 1.42;
  let h = 0;
  for (const b of blocks) {
    if (b.type === "p" || b.type === "note" || b.type === "custom" || b.type === "h") {
      h += Math.max(1, Math.ceil(b.text.length / cpl)) * line + size * 0.55;
    } else if (b.type === "ul" || b.type === "ol") {
      h += b.items.reduce((s, t) => s + Math.max(1, Math.ceil(t.length / (cpl - 3))) * line + size * 0.2, 0) + size * 0.55;
    } else if (b.type === "table") h += b.rows.length * (line + 8);
    else if (b.type === "img") h += 200;
  }
  return h;
}

/** Splits blocks into "beside the float" and "full width below" so a tall image doesn't leave a gap. */
export function splitForFloat(blocks: Block[], colWidth: number, floatHeight: number, size: number = SIZE.body) {
  const beside: Block[] = [];
  let used = 0;
  let i = 0;
  for (; i < blocks.length; i++) {
    const h = estimateHeight([blocks[i]], colWidth, size);
    if (beside.length > 0 && used + h > floatHeight) break;
    beside.push(blocks[i]);
    used += h;
  }
  return { beside, below: blocks.slice(i) };
}

/* ---------------------------------------------------------------- page chrome */

export type PageBg = "milk" | "products" | "room";

export interface Box {
  left: number;
  top: number;
  /** distance from the bottom edge of the page */
  bottom: number;
  width: number;
}

/** Soft card shadow built from stacked translucent shapes (react-pdf has no box-shadow). */
export function CardShell({ box, radius = GEO.cardRadius }: { box: Box; radius?: number }) {
  const h = PAGE.h - box.top - box.bottom;
  return (
    <View fixed style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: h }}>
      {[10, 7, 4, 2].map((spread, i) => (
        <View
          key={spread}
          style={{
            position: "absolute",
            left: -spread / 2,
            top: -spread / 4 + 2,
            width: box.width + spread,
            height: h + spread,
            borderRadius: radius + spread / 2,
            backgroundColor: COLOR.shadow,
            opacity: 0.035 + i * 0.01,
          }}
        />
      ))}
      <View style={{ position: "absolute", left: 0, top: 0, width: box.width, height: h, borderRadius: radius, backgroundColor: COLOR.white }} />
    </View>
  );
}

export function Background({ bg, src }: { bg: PageBg; src?: ImageSrc }) {
  if (bg === "milk") {
    return <View fixed style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h, backgroundColor: COLOR.milk }} />;
  }
  return (
    <View fixed style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h }}>
      <Img src={src} style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h }} />
      <View style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h, backgroundColor: COLOR.overlay, opacity: 0.2 }} />
    </View>
  );
}

/** Vertical brand caption down the left edge (rotated 90°, reads top to bottom, as in the references). */
export function SideText({ text, color }: { text: string; color: string }) {
  if (!text.trim()) return null;
  const tops = [-1, 137, 274, 411, 548, 685];
  return (
    <>
      {tops.map((top) => (
        <Text
          key={top}
          fixed
          style={{
            position: "absolute",
            left: 19,
            top,
            width: 130,
            fontFamily: FONT.sans,
            fontSize: SIZE.sideText,
            color,
            transform: "rotate(90deg)",
            transformOrigin: "0 0",
          }}
        >
          {text}
        </Text>
      ))}
    </>
  );
}

export function PageTitle({ title, color, left = 31 }: { title: string; color: string; left?: number }) {
  return (
    <Text
      fixed
      render={({ subPageNumber }) => (subPageNumber > 1 ? `${title} (продолжение)` : title)}
      style={{
        position: "absolute",
        left,
        top: GEO.titleTop,
        width: PAGE.w - left - 20,
        fontFamily: FONT.serif,
        fontSize: SIZE.pageTitle,
        lineHeight: 1.15,
        color,
      }}
    />
  );
}

/** Wraps flowing content so it stays inside the card on every (continuation) page. */
export function StdPage({
  title,
  titleColor,
  bg,
  bgSrc,
  box,
  side,
  children,
  behind,
  front,
}: {
  title: string;
  titleColor: string;
  bg: PageBg;
  bgSrc?: ImageSrc;
  box: Box;
  side?: { text: string; color: string };
  children: React.ReactNode;
  /** Decorations drawn between the background and the card (e.g. photos peeking out behind it). */
  behind?: React.ReactNode;
  /** Fixed decorations drawn above the card. */
  front?: React.ReactNode;
}) {
  return (
    <Page
      size={[PAGE.w, PAGE.h]}
      wrap
      style={{
        paddingTop: box.top + GEO.cardPadTop,
        paddingBottom: box.bottom + GEO.cardPadBottom,
        paddingLeft: box.left + GEO.cardPadX,
        paddingRight: PAGE.w - box.left - box.width + GEO.cardPadX,
        fontFamily: FONT.sans,
      }}
    >
      <Background bg={bg} src={bgSrc} />
      {behind}
      <CardShell box={box} />
      {side && <SideText text={side.text} color={side.color} />}
      <PageTitle title={title} color={titleColor} />
      {front}
      {children}
    </Page>
  );
}

/* ---------------------------------------------------------------- face diagram */

export function FaceDiagram({
  src,
  strokes,
  size,
}: {
  src?: ImageSrc;
  strokes: Stroke[];
  size: number;
}) {
  return (
    <View style={{ width: size, height: size }} wrap={false}>
      <Img src={src} style={{ width: size, height: size, borderRadius: 18 }} />
      <Svg viewBox="0 0 1 1" style={{ position: "absolute", left: 0, top: 0, width: size, height: size }}>
        {strokes.map((s) => (
          <Polyline
            key={s.id}
            points={s.points.map(([x, y]) => `${x},${y}`).join(" ")}
            stroke={s.color === "green" ? COLOR.green : COLOR.red}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export function Legend() {
  return (
    <View style={{ marginTop: 8 }} wrap={false}>
      {(
        [
          [COLOR.green, "зона нанесения средств"],
          [COLOR.red, "не наносить"],
        ] as const
      ).map(([c, t]) => (
        <View key={t} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
          <Svg viewBox="0 0 40 4" style={{ width: 40, height: 4, marginRight: 6 }}>
            <Line x1="1" y1="2" x2="39" y2="2" stroke={c} strokeWidth="3" strokeLinecap="round" />
          </Svg>
          <Text style={{ fontFamily: FONT.sans, fontSize: 8.5, color: COLOR.textSoft }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- misc shapes */

export function RadioDot({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <Svg viewBox="0 0 20 20" style={{ width: size, height: size }}>
      <Circle cx="10" cy="10" r="8.5" stroke={COLOR.text} strokeWidth="1.3" fill={on ? COLOR.text : "none"} />
    </Svg>
  );
}

export function ExternalLink({ src, children, style }: { src: string; children: React.ReactNode; style?: Style }) {
  return src ? (
    <Link src={src} style={{ textDecoration: "none", color: "inherit", ...style }}>
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}
