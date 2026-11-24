"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "@/components/block-editor";
import { Field, Segmented, TriField } from "@/components/fields";
import { FaceEditor } from "@/components/face-editor";
import { MediaPicker } from "@/components/media-picker";
import { PriceEditor } from "@/components/price-editor";
import { VoiceInput } from "@/components/voice-input";
import {
  COVER_VARIANTS,
  COVER_VARIANT_LABEL,
  CYCLE,
  HOME_CARE_DECISIONS,
  HOME_CARE_LABEL,
  PREGNANCY,
  TITLE_COLORS,
  mkBlock,
  type Block,
  type CardData,
  type ProcedureItem,
  type ProductItem,
} from "@/lib/schemas/card";
import { emptyPrice, uid } from "@/lib/schemas/common";

export type Patch = (fn: (draft: CardData) => void) => void;

export interface SectionProps {
  card: CardData;
  patch: Patch;
  /** Opens the media picker; `done` receives the chosen asset id. */
  pickImage: (category: "brand" | "product" | "specialist" | "patient" | "illustration", done: (assetId: string) => void) => void;
  faceUrl: string | null;
}

const lbl = { white: "Белый", burgundy: "Бордовый", dark: "Тёмный" } as const;
const CYCLE_LABEL = { regular: "Регулярный", irregular: "Нерегулярный", unknown: "Неизвестно", unspecified: "Не указано" } as const;
const PREG_LABEL = { yes: "Да", no: "Нет", planning: "Планирование", unknown: "Неизвестно", unspecified: "Не указано" } as const;
const SEBUM = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const Box = ({ title, children, hint }: { title?: string; hint?: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-md border bg-surface p-4">
    {title && <h3 className="font-serif text-base">{title}</h3>}
    {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
    {children}
  </section>
);

const blocksOf = (b: Block[], set: (n: Block[]) => void, label: string, pickImage?: SectionProps["pickImage"]) => (
  <BlockEditor blocks={b} onChange={set} label={label} onPickImage={pickImage ? (done) => pickImage("patient", done) : undefined} />
);

/* ------------------------------------------------------------ 1. cover */
export function CoverSection({ card, patch }: SectionProps) {
  const d = card.design;
  return (
    <div className="space-y-4">
      <Box title="Вариант обложки">
        <Segmented
          label="Вариант обложки"
          value={d.coverVariant}
          onChange={(v) => patch((c) => void (c.design.coverVariant = v))}
          options={COVER_VARIANTS.map((v) => ({ value: v, label: COVER_VARIANT_LABEL[v] }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Цвет заголовка">
            <Segmented label="Цвет заголовка" value={d.coverTitleColor} onChange={(v) => patch((c) => void (c.design.coverTitleColor = v))} options={TITLE_COLORS.map((v) => ({ value: v, label: lbl[v] }))} />
          </Field>
          <Field label="Цвет ФИО">
            <Segmented label="Цвет ФИО" value={d.coverNameColor} onChange={(v) => patch((c) => void (c.design.coverNameColor = v))} options={TITLE_COLORS.map((v) => ({ value: v, label: lbl[v] }))} />
          </Field>
        </div>
        <Field label="Заголовок" htmlFor="cv-title">
          <Input id="cv-title" value={d.coverTitle} maxLength={60} onChange={(e) => patch((c) => void (c.design.coverTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        <p className="text-xs text-muted-foreground">Длинное ФИО переносится на несколько строк и уменьшается автоматически. Фон обложки меняется в «Настройки → Фирменные изображения».</p>
      </Box>
      <Box title="Оформление страниц">
        <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-8">
          <input type="checkbox" className="size-4 accent-primary" checked={d.showSideText} onChange={(e) => patch((c) => void (c.design.showSideText = e.target.checked))} />
          Вертикальная фирменная надпись
        </label>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 2. personal */
export function PersonalSection({ card, patch, onRefresh }: SectionProps & { onRefresh: () => void }) {
  const p = card.personal;
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => patch((c) => void (c.personal[k] = v));
  return (
    <div className="space-y-4">
      <Box hint="Данные берутся из профиля и анамнеза пациента. Здесь можно поправить только эту карту.">
        <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={onRefresh}>
          Обновить из анамнеза
        </Button>
        <Field label="ФИО на карте" htmlFor="p-name">
          <Input id="p-name" value={p.fullName} onChange={(e) => set("fullName", e.target.value)} className="h-11 sm:h-8" />
        </Field>
        <Field label="Возраст" htmlFor="p-age">
          <Input id="p-age" value={p.ageText} onChange={(e) => set("ageText", e.target.value)} className="h-11 sm:h-8" />
        </Field>
        <Field label="Аллергии">
          <TriField label="Аллергии" value={p.allergiesState} onChange={(v) => set("allergiesState", v)} />
          <VoiceInput multiline={false} value={p.allergies} onChange={(v) => set("allergies", v)} placeholder="Уточнение" aria-label="Аллергии: уточнение" />
        </Field>
        <Field label="Хронические заболевания">
          <TriField label="Хронические заболевания" value={p.chronicState} onChange={(v) => set("chronicState", v)} />
          <VoiceInput multiline={false} value={p.chronic} onChange={(v) => set("chronic", v)} placeholder="Уточнение" aria-label="Хронические заболевания: уточнение" />
        </Field>
        <Field label="Щитовидная железа">
          <TriField label="Щитовидная железа" value={p.thyroidState} onChange={(v) => set("thyroidState", v)} />
          <VoiceInput multiline={false} value={p.thyroid} onChange={(v) => set("thyroid", v)} placeholder="Уточнение" aria-label="Щитовидная железа: уточнение" />
        </Field>
        <Field label="Анализы на гормоны">
          <TriField label="Анализы на гормоны" value={p.hormoneTests} onChange={(v) => set("hormoneTests", v)} />
        </Field>
        <Field label="Цикл">
          <Segmented label="Цикл" value={p.cycle} onChange={(v) => set("cycle", v)} options={CYCLE.map((v) => ({ value: v, label: CYCLE_LABEL[v] }))} />
        </Field>
        <Field label="Беременность">
          <Segmented label="Беременность" value={p.pregnancy} onChange={(v) => set("pregnancy", v)} options={PREGNANCY.map((v) => ({ value: v, label: PREG_LABEL[v] }))} />
        </Field>
        <Field label="Лактация">
          <TriField label="Лактация" value={p.lactation} onChange={(v) => set("lactation", v)} />
        </Field>
        <Field label="Тип себосекреции" hint="Шкала 1–5; в PDF показывается отметка на шкале">
          <Segmented
            label="Себосекреция"
            value={p.sebum}
            onChange={(v) => patch((c) => { c.personal.sebum = v; c.personal.sebumText = String(v).replace(".", ","); })}
            options={SEBUM.map((v) => ({ value: v, label: String(v).replace(".", ",") }))}
          />
        </Field>
        <Field label="Подпись к шкале (например 3-4)" htmlFor="p-sebum">
          <Input id="p-sebum" value={p.sebumText} onChange={(e) => set("sebumText", e.target.value)} className="h-11 sm:h-8" />
        </Field>
      </Box>
      <Box title="Индивидуальные поля">
        {p.custom.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-start gap-2">
            <Input value={f.label} onChange={(e) => patch((c) => void (c.personal.custom[i].label = e.target.value))} placeholder="Название" aria-label="Название поля" className="h-11 w-44 sm:h-8" />
            <div className="min-w-48 flex-1">
              <VoiceInput multiline={false} value={f.value} onChange={(v) => patch((c) => void (c.personal.custom[i].value = v))} placeholder="Значение" aria-label="Значение поля" />
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить поле" onClick={() => patch((c) => void c.personal.custom.splice(i, 1))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => patch((c) => void c.personal.custom.push({ id: uid(), label: "", value: "" }))}>
          <Plus /> Добавить поле
        </Button>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 3. skin */
export function SkinSection({ card, patch, pickImage }: SectionProps) {
  return (
    <div className="space-y-4">
      <Box title="Заключение о состоянии кожи">{blocksOf(card.skin.blocks, (n) => patch((c) => void (c.skin.blocks = n)), "Состояние кожи", pickImage)}</Box>
      <Box title="Фотографии" hint="Необязательно. В PDF попадают только выбранные вручную.">
        <div className="flex flex-wrap gap-2">
          {card.skin.photoIds.map((id, i) => (
            <span key={id} className="flex items-center gap-1 rounded border bg-secondary px-2 py-1 text-xs">
              Фото {i + 1}
              <button type="button" aria-label="Убрать фото" onClick={() => patch((c) => void c.skin.photoIds.splice(i, 1))} className="grid size-6 place-items-center text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={card.skin.photoIds.length >= 6} onClick={() => pickImage("patient", (id) => patch((c) => void c.skin.photoIds.push(id)))}>
          <Plus /> Добавить фото
        </Button>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 4. care */
export function CareSection({ card, patch, pickImage, faceUrl }: SectionProps) {
  const care = card.care;
  return (
    <div className="space-y-4">
      <Box title="Утренний уход">
        <Field label="Заголовок" htmlFor="care-m">
          <Input id="care-m" value={care.morningTitle} onChange={(e) => patch((c) => void (c.care.morningTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(care.morning, (n) => patch((c) => void (c.care.morning = n)), "Утренний уход", pickImage)}
      </Box>
      <Box title="Вечерний уход">
        <Field label="Заголовок" htmlFor="care-e">
          <Input id="care-e" value={care.eveningTitle} onChange={(e) => patch((c) => void (c.care.eveningTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(care.evening, (n) => patch((c) => void (c.care.evening = n)), "Вечерний уход", pickImage)}
      </Box>
      <Box title="Примечания к уходу">{blocksOf(care.notes, (n) => patch((c) => void (c.care.notes = n)), "Примечания к уходу", pickImage)}</Box>
      <Box title="Схема нанесения средств" hint="Зелёным отмечаются разрешённые зоны, красным — исключённые.">
        <FaceEditor
          imageUrl={faceUrl}
          strokes={care.face.strokes}
          onChange={(s) => patch((c) => void (c.care.face.strokes = s))}
          onPickIllustration={() => pickImage("illustration", (id) => patch((c) => void (c.design.imageOverrides.face_illustration = id)))}
        />
      </Box>
      <Box title="Текущий домашний уход пациента" hint="Отметьте, какие имеющиеся средства оставить, заменить, исключить или добавить позднее.">
        {care.homeCare.map((h, i) => (
          <div key={h.id} className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2">
              <Input value={h.name} onChange={(e) => patch((c) => void (c.care.homeCare[i].name = e.target.value))} placeholder="Средство" aria-label="Название средства" className="h-11 flex-1 sm:h-8" />
              <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить" onClick={() => patch((c) => void c.care.homeCare.splice(i, 1))}>
                <Trash2 />
              </Button>
            </div>
            <Segmented label="Решение" value={h.decision} onChange={(v) => patch((c) => void (c.care.homeCare[i].decision = v))} options={HOME_CARE_DECISIONS.map((v) => ({ value: v, label: HOME_CARE_LABEL[v] }))} />
            <Input value={h.note} onChange={(e) => patch((c) => void (c.care.homeCare[i].note = e.target.value))} placeholder="Комментарий" aria-label="Комментарий" className="h-11 sm:h-8" />
          </div>
        ))}
        <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => patch((c) => void c.care.homeCare.push({ id: uid(), name: "", decision: "keep", note: "" }))}>
          <Plus /> Добавить средство
        </Button>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 5-7 */
export function ActivesSection({ card, patch, pickImage }: SectionProps) {
  return (
    <div className="space-y-4">
      <Box title="Активы и лечебные средства">{blocksOf(card.actives.blocks, (n) => patch((c) => void (c.actives.blocks = n)), "Активы", pickImage)}</Box>
      <Box title="Примечание">
        <Field label="Заголовок" htmlFor="act-n">
          <Input id="act-n" value={card.actives.noteTitle} onChange={(e) => patch((c) => void (c.actives.noteTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(card.actives.note, (n) => patch((c) => void (c.actives.note = n)), "Примечание", pickImage)}
      </Box>
    </div>
  );
}

export function NutritionSection({ card, patch, pickImage }: SectionProps) {
  return (
    <div className="space-y-4">
      <Box title="Основные рекомендации">
        <Field label="Заголовок" htmlFor="nu-m">
          <Input id="nu-m" value={card.nutrition.mainTitle} onChange={(e) => patch((c) => void (c.nutrition.mainTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(card.nutrition.main, (n) => patch((c) => void (c.nutrition.main = n)), "Питание", pickImage)}
      </Box>
      <Box title="Дополнения">
        <Field label="Заголовок" htmlFor="nu-e">
          <Input id="nu-e" value={card.nutrition.extraTitle} onChange={(e) => patch((c) => void (c.nutrition.extraTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(card.nutrition.extra, (n) => patch((c) => void (c.nutrition.extra = n)), "Дополнения к питанию", pickImage)}
      </Box>
    </div>
  );
}

export function VitaminsSection({ card, patch, pickImage }: SectionProps) {
  return (
    <div className="space-y-4">
      <Box title="Витамины и БАДы" hint="Дозировки и единицы измерения вводит специалист. Приложение их не меняет.">
        <Field label="Заголовок" htmlFor="vi-s">
          <Input id="vi-s" value={card.vitamins.supplementsTitle} onChange={(e) => patch((c) => void (c.vitamins.supplementsTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(card.vitamins.supplements, (n) => patch((c) => void (c.vitamins.supplements = n)), "Витамины", pickImage)}
      </Box>
      <Box title="Анализы">
        <Field label="Заголовок" htmlFor="vi-t">
          <Input id="vi-t" value={card.vitamins.testsTitle} onChange={(e) => patch((c) => void (c.vitamins.testsTitle = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        {blocksOf(card.vitamins.tests, (n) => patch((c) => void (c.vitamins.tests = n)), "Анализы", pickImage)}
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 8. products */
const emptyProduct = (): ProductItem => ({
  id: uid(),
  productId: null,
  label: "",
  brand: "",
  name: "",
  isAlternative: false,
  variants: [{ id: uid(), volume: "", price: emptyPrice() }],
  note: "",
  url: "",
});

export function ProductsSection({ card, patch, onPickCatalog }: SectionProps & { onPickCatalog?: () => void }) {
  const items = card.products.items;
  const setItem = (i: number, fn: (it: ProductItem) => void) => patch((c) => fn(c.products.items[i]));
  const swap = (i: number, j: number) => patch((c) => {
    if (j < 0 || j >= c.products.items.length) return;
    [c.products.items[i], c.products.items[j]] = [c.products.items[j], c.products.items[i]];
  });
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <Box key={it.id}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {i + 1}. {[it.brand, it.name].filter(Boolean).join(" ") || "Новая позиция"}
            </span>
            <div className="flex">
              <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Выше" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Ниже" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить позицию" onClick={() => patch((c) => void c.products.items.splice(i, 1))}>
                <Trash2 />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Бренд" htmlFor={`pb-${it.id}`}>
              <Input id={`pb-${it.id}`} value={it.brand} onChange={(e) => setItem(i, (x) => void (x.brand = e.target.value))} className="h-11 sm:h-8" />
            </Field>
            <Field label="Название" htmlFor={`pn-${it.id}`}>
              <Input id={`pn-${it.id}`} value={it.name} onChange={(e) => setItem(i, (x) => void (x.name = e.target.value))} className="h-11 sm:h-8" />
            </Field>
            <Field label="Заголовок группы (например «очищение:»)" htmlFor={`pl-${it.id}`}>
              <Input id={`pl-${it.id}`} value={it.label} onChange={(e) => setItem(i, (x) => void (x.label = e.target.value))} className="h-11 sm:h-8" />
            </Field>
            <Field label="Ссылка на покупку" htmlFor={`pu-${it.id}`}>
              <Input id={`pu-${it.id}`} type="url" inputMode="url" value={it.url} onChange={(e) => setItem(i, (x) => void (x.url = e.target.value))} placeholder="https://" className="h-11 sm:h-8" />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-8">
            <input type="checkbox" className="size-4 accent-primary" checked={it.isAlternative} onChange={(e) => setItem(i, (x) => void (x.isAlternative = e.target.checked))} />
            Альтернатива предыдущему («или …»)
          </label>
          <div className="space-y-3">
            <p className="text-[13px] font-medium">Объёмы и цены</p>
            {it.variants.map((v, vi) => (
              <div key={v.id} className="space-y-2 rounded-md border p-3">
                <div className="flex gap-2">
                  <Input value={v.volume} onChange={(e) => setItem(i, (x) => void (x.variants[vi].volume = e.target.value))} placeholder="Объём, например 50 мл" aria-label="Объём" className="h-11 flex-1 sm:h-8" />
                  <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить вариант" disabled={it.variants.length === 1} onClick={() => setItem(i, (x) => void x.variants.splice(vi, 1))}>
                    <Trash2 />
                  </Button>
                </div>
                <PriceEditor label={`Позиция ${i + 1}, вариант ${vi + 1}`} value={v.price} onChange={(p) => setItem(i, (x) => void (x.variants[vi].price = p))} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" disabled={it.variants.length >= 8} onClick={() => setItem(i, (x) => void x.variants.push({ id: uid(), volume: "", price: emptyPrice() }))}>
              <Plus /> Ещё объём / цена
            </Button>
          </div>
          <Field label="Комментарий специалиста" htmlFor={`pc-${it.id}`}>
            <VoiceInput id={`pc-${it.id}`} multiline={false} value={it.note} onChange={(v) => setItem(i, (x) => void (x.note = v))} />
          </Field>
        </Box>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 sm:h-8" onClick={() => patch((c) => void c.products.items.push(emptyProduct()))}>
          <Plus /> Добавить средство
        </Button>
        {onPickCatalog && (
          <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={onPickCatalog}>
            Из каталога
          </Button>
        )}
      </div>
      <Box title="Примечание внизу страницы">
        <VoiceInput value={card.products.footnote} onChange={(v) => patch((c) => void (c.products.footnote = v))} rows={3} aria-label="Примечание внизу страницы" />
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ 9. procedures */
const emptyProc = (): ProcedureItem => ({
  id: uid(),
  name: "",
  description: "",
  sessions: "",
  frequency: "",
  dosage: "",
  volume: "",
  isAlternative: false,
  price: emptyPrice(),
});

export function ProceduresSection({ card, patch }: SectionProps) {
  const plans = card.procedures.plans;
  return (
    <div className="space-y-4">
      {plans.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Планов пока нет. Добавьте первый.</p>}
      {plans.map((plan, pi) => (
        <Box key={plan.id}>
          <div className="flex items-center gap-2">
            <Input value={plan.title} onChange={(e) => patch((c) => void (c.procedures.plans[pi].title = e.target.value))} aria-label="Название плана" className="h-11 flex-1 font-medium sm:h-8" />
            <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить план" onClick={() => patch((c) => void c.procedures.plans.splice(pi, 1))}>
              <Trash2 />
            </Button>
          </div>
          {plan.items.map((it, ii) => {
            const set = (fn: (x: ProcedureItem) => void) => patch((c) => fn(c.procedures.plans[pi].items[ii]));
            return (
              <div key={it.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">№ {ii + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить процедуру" onClick={() => patch((c) => void c.procedures.plans[pi].items.splice(ii, 1))}>
                    <Trash2 />
                  </Button>
                </div>
                <Field label="Название" htmlFor={`prn-${it.id}`}>
                  <VoiceInput id={`prn-${it.id}`} multiline={false} value={it.name} onChange={(v) => set((x) => void (x.name = v))} />
                </Field>
                <Field label="Описание" htmlFor={`prd-${it.id}`}>
                  <VoiceInput id={`prd-${it.id}`} value={it.description} onChange={(v) => set((x) => void (x.description = v))} rows={2} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Количество сеансов" htmlFor={`prs-${it.id}`}>
                    <Input id={`prs-${it.id}`} value={it.sessions} onChange={(e) => set((x) => void (x.sessions = e.target.value))} placeholder="3–5 процедур" className="h-11 sm:h-8" />
                  </Field>
                  <Field label="Периодичность" htmlFor={`prf-${it.id}`}>
                    <Input id={`prf-${it.id}`} value={it.frequency} onChange={(e) => set((x) => void (x.frequency = e.target.value))} placeholder="1 раз в 4 недели" className="h-11 sm:h-8" />
                  </Field>
                  <Field label="Дозировка" htmlFor={`prz-${it.id}`}>
                    <Input id={`prz-${it.id}`} value={it.dosage} onChange={(e) => set((x) => void (x.dosage = e.target.value))} placeholder="50 ед" className="h-11 sm:h-8" />
                  </Field>
                  <Field label="Объём" htmlFor={`prv-${it.id}`}>
                    <Input id={`prv-${it.id}`} value={it.volume} onChange={(e) => set((x) => void (x.volume = e.target.value))} placeholder="3 мл" className="h-11 sm:h-8" />
                  </Field>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-8">
                  <input type="checkbox" className="size-4 accent-primary" checked={it.isAlternative} onChange={(e) => set((x) => void (x.isAlternative = e.target.checked))} />
                  Альтернатива предыдущей («или …»)
                </label>
                <Field label="Стоимость">
                  <PriceEditor label={`${plan.title}, № ${ii + 1}`} value={it.price} onChange={(p) => set((x) => void (x.price = p))} />
                </Field>
              </div>
            );
          })}
          <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => patch((c) => void c.procedures.plans[pi].items.push(emptyProc()))}>
            <Plus /> Добавить процедуру
          </Button>
        </Box>
      ))}
      <Button type="button" className="h-11 sm:h-8" disabled={plans.length >= 6} onClick={() => patch((c) => void c.procedures.plans.push({ id: uid(), title: c.procedures.plans.length ? `Вариант ${c.procedures.plans.length + 1}` : "Основной план", items: [emptyProc()] }))}>
        <Plus /> {plans.length ? "Альтернативный план" : "Добавить план"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------ 10. conclusion */
export function ConclusionSection({ card, patch, pickImage }: SectionProps) {
  return (
    <div className="space-y-4">
      <Box title="Заключение">{blocksOf(card.conclusion.blocks, (n) => patch((c) => void (c.conclusion.blocks = n)), "Заключение", pickImage)}</Box>
      <Box title="Кнопка">
        <Field label="Текст кнопки" htmlFor="co-btn">
          <Input id="co-btn" value={card.conclusion.buttonLabel} onChange={(e) => patch((c) => void (c.conclusion.buttonLabel = e.target.value))} className="h-11 sm:h-8" />
        </Field>
        <p className="text-xs text-muted-foreground">Ссылка берётся из «Настройки → Специалист и контакты». Фото специалиста — из фирменных изображений.</p>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------ extra pages */
export function ExtraSection({ card, patch, pickImage }: SectionProps) {
  const pages = card.extraPages;
  const [open, setOpen] = useState<string | null>(null);
  const swap = (i: number, j: number) => patch((c) => {
    if (j < 0 || j >= c.extraPages.length) return;
    [c.extraPages[i], c.extraPages[j]] = [c.extraPages[j], c.extraPages[i]];
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Дополнительные страницы идут после стандартных десяти и не меняют их структуру. «Фотографии и динамика» добавляется только по вашему желанию.
      </p>
      {pages.map((p, i) => (
        <Box key={p.id}>
          <div className="flex items-center gap-2">
            <Input value={p.title} onChange={(e) => patch((c) => void (c.extraPages[i].title = e.target.value))} aria-label="Название страницы" className="h-11 flex-1 font-medium sm:h-8" />
            <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Выше" disabled={i === 0} onClick={() => swap(i, i - 1)}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Ниже" disabled={i === pages.length - 1} onClick={() => swap(i, i + 1)}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Удалить страницу" onClick={() => patch((c) => void c.extraPages.splice(i, 1))}>
              <Trash2 />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{p.kind === "photos" ? "Фотографии и динамика" : "Текстовая страница"}</p>
          {p.kind === "photos" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {p.photoIds.map((id, k) => (
                  <span key={id} className="flex items-center gap-1 rounded border bg-secondary px-2 py-1 text-xs">
                    Фото {k + 1}
                    <button type="button" aria-label="Убрать фото" onClick={() => patch((c) => void c.extraPages[i].photoIds.splice(k, 1))} className="grid size-6 place-items-center text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={p.photoIds.length >= 12} onClick={() => pickImage("patient", (id) => patch((c) => void c.extraPages[i].photoIds.push(id)))}>
                <Plus /> Добавить фото
              </Button>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" onClick={() => setOpen(open === p.id ? null : p.id)}>
            {open === p.id ? "Скрыть текст" : "Редактировать текст"}
          </Button>
          {open === p.id && blocksOf(p.blocks, (n) => patch((c) => void (c.extraPages[i].blocks = n)), p.title, pickImage)}
        </Box>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={pages.length >= 10} onClick={() => patch((c) => void c.extraPages.push({ id: uid(), kind: "text", title: "Дополнительно", blocks: [mkBlock("p")], photoIds: [] }))}>
          <Plus /> Текстовая страница
        </Button>
        <Button type="button" variant="outline" className="h-11 sm:h-8" disabled={pages.length >= 10} onClick={() => patch((c) => void c.extraPages.push({ id: uid(), kind: "photos", title: "Фотографии и динамика", blocks: [], photoIds: [] }))}>
          <Plus /> Фотографии и динамика
        </Button>
      </div>
    </div>
  );
}

export { MediaPicker };
