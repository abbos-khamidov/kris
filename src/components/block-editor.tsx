"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Proofread } from "@/components/proofread";
import { TemplateBar } from "@/components/template-bar";
import type { TemplateKind } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VoiceInput } from "@/components/voice-input";
import { BLOCK_LABEL, BLOCK_TYPES, Block, mkBlock, type BlockType } from "@/lib/schemas/card";
import { uid } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

export interface BlockEditorProps {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  /** Label for screen readers and the empty state. */
  label: string;
  /** Enables "From library" / "Save as template" for this field. */
  templateKind?: TemplateKind;
  /** Lets the parent choose a media asset for image blocks. */
  onPickImage?: (done: (assetId: string) => void) => void;
}

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [it] = copy.splice(from, 1);
  copy.splice(to, 0, it);
  return copy;
};

/**
 * The document is built from blocks, not fixed inputs (ADR-010). Each block can be typed, dictated,
 * or filled from the approved-template library; blocks can be added, moved, duplicated and deleted.
 */
export function BlockEditor({ blocks, onChange, label, templateKind, onPickImage }: BlockEditorProps) {
  const set = (i: number, patch: Partial<Block>) => onChange(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const add = (type: BlockType) => onChange([...blocks, mkBlock(type)]);

  return (
    <div className="space-y-3" role="group" aria-label={label}>
      {blocks.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Пока пусто. Добавьте блок, продиктуйте текст или возьмите из библиотеки.
        </p>
      )}

      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-md border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">{BLOCK_LABEL[b.type]}</span>
            <div className="flex items-center">
              <IconBtn label="Выше" onClick={() => onChange(move(blocks, i, i - 1))} disabled={i === 0}>
                <ArrowUp />
              </IconBtn>
              <IconBtn label="Ниже" onClick={() => onChange(move(blocks, i, i + 1))} disabled={i === blocks.length - 1}>
                <ArrowDown />
              </IconBtn>
              <IconBtn
                label="Дублировать"
                onClick={() => {
                  const copy = structuredClone(b);
                  copy.id = uid();
                  const next = [...blocks];
                  next.splice(i + 1, 0, copy);
                  onChange(next);
                }}
              >
                <Copy />
              </IconBtn>
              <IconBtn label="Удалить блок" onClick={() => onChange(blocks.filter((_, idx) => idx !== i))} danger>
                <Trash2 />
              </IconBtn>
            </div>
          </div>
          <div className="p-3">
            <BlockBody block={b} label={`${label}, блок ${i + 1}`} onChange={(patch) => set(i, patch)} onPickImage={onPickImage} />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" className="h-11 sm:h-8" />}>
            <Plus /> Добавить блок
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {BLOCK_TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => add(t)} className="min-h-10">
                {BLOCK_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {templateKind && (
          <TemplateBar
            kind={templateKind}
            canSave={blocks.length > 0}
            getBody={() => blocks}
            onInsert={(body) => {
              const parsed = z.array(Block).safeParse(body);
              if (!parsed.success) return void toast.error("Шаблон не подходит к этому разделу");
              onChange([...blocks, ...parsed.data.map((b) => ({ ...b, id: uid() }))]);
              toast.success("Вставлено — проверьте текст");
            }}
          />
        )}
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-11 place-items-center rounded text-muted-foreground transition-colors enabled:hover:bg-secondary disabled:opacity-30 sm:size-8 [&_svg]:size-4",
        danger && "enabled:hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function BlockBody({
  block: b,
  label,
  onChange,
  onPickImage,
}: {
  block: Block;
  label: string;
  onChange: (patch: Partial<Block>) => void;
  onPickImage?: BlockEditorProps["onPickImage"];
}) {
  switch (b.type) {
    case "h":
      return <VoiceInput multiline={false} value={b.text} onChange={(text) => onChange({ text })} placeholder="Заголовок" aria-label={label} />;
    case "p":
      return <VoiceInput format value={b.text} onChange={(text) => onChange({ text })} rows={4} placeholder="Текст" aria-label={label} />;
    case "note":
      return (
        <div className="space-y-2">
          <Input value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Заголовок примечания (необязательно)" aria-label={`${label}: заголовок`} className="h-11 sm:h-8" />
          <Proofread value={b.title} onChange={(title) => onChange({ title })} />
          <VoiceInput format value={b.text} onChange={(text) => onChange({ text })} rows={3} placeholder="Текст примечания" aria-label={label} />
        </div>
      );
    case "custom":
      return (
        <div className="space-y-2">
          <Input value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Название блока" aria-label={`${label}: название`} className="h-11 sm:h-8" />
          <Proofread value={b.title} onChange={(title) => onChange({ title })} />
          <VoiceInput format value={b.text} onChange={(text) => onChange({ text })} rows={4} placeholder="Содержимое" aria-label={label} />
        </div>
      );
    case "ul":
    case "ol":
      return <ListBody block={b} label={label} onChange={onChange} />;
    case "table":
      return <TableBody block={b} label={label} onChange={onChange} />;
    case "img":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <span className={cn(b.assetId ? "text-foreground" : "text-muted-foreground")}>{b.assetId ? "Изображение выбрано" : "Изображение не выбрано"}</span>
            {onPickImage && (
              <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" onClick={() => onPickImage((assetId) => onChange({ assetId }))}>
                {b.assetId ? "Заменить" : "Выбрать"}
              </Button>
            )}
          </div>
          <Input value={b.caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Подпись (необязательно)" aria-label={`${label}: подпись`} className="h-11 sm:h-8" />
          <Proofread value={b.caption} onChange={(caption) => onChange({ caption })} />
        </div>
      );
  }
}

function ListBody({ block: b, label, onChange }: { block: Block; label: string; onChange: (p: Partial<Block>) => void }) {
  const items = b.items.length ? b.items : [""];
  const setItem = (i: number, v: string) => onChange({ items: items.map((t, idx) => (idx === i ? v : t)) });
  return (
    <ol className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-6 shrink-0 text-right text-sm text-muted-foreground">{b.type === "ol" ? `${i + 1}.` : "•"}</span>
          <div className="min-w-0 flex-1">
            <VoiceInput format multiline={false} value={t} onChange={(v) => setItem(i, v)} placeholder={`Пункт ${i + 1}`} aria-label={`${label}: пункт ${i + 1}`} />
          </div>
          <IconBtn label="Удалить пункт" danger onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })} disabled={items.length === 1}>
            <Trash2 />
          </IconBtn>
        </li>
      ))}
      <li>
        <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" onClick={() => onChange({ items: [...items, ""] })}>
          <Plus /> Пункт
        </Button>
      </li>
    </ol>
  );
}

function TableBody({ block: b, label, onChange }: { block: Block; label: string; onChange: (p: Partial<Block>) => void }) {
  // One button for the whole table, bound to the cell that was edited last.
  const [active, setActive] = useState<[number, number] | null>(null);
  const cols = Math.max(2, b.rows[0]?.length ?? 2);
  const rows = b.rows.length ? b.rows : [Array(cols).fill("")];
  const setCell = (r: number, c: number, v: string) =>
    onChange({ rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) });
  return (
    <div className="space-y-2">
      <Input value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Название таблицы (необязательно)" aria-label={`${label}: название`} className="h-11 sm:h-8" />
      <Proofread value={b.title} onChange={(title) => onChange({ title })} />
      <div className="space-y-1.5 overflow-x-auto">
        {rows.map((row, r) => (
          <div key={r} className="flex gap-1.5">
            {Array.from({ length: cols }, (_, c) => (
              <Input
                key={c}
                value={row[c] ?? ""}
                onChange={(e) => setCell(r, c, e.target.value)}
                onFocus={() => setActive([r, c])}
                aria-label={`${label}: строка ${r + 1}, столбец ${c + 1}`}
                className={cn("h-11 min-w-28 flex-1 sm:h-8", r === 0 && b.header && "font-semibold")}
              />
            ))}
            <IconBtn label="Удалить строку" danger disabled={rows.length === 1} onClick={() => onChange({ rows: rows.filter((_, ri) => ri !== r) })}>
              <Trash2 />
            </IconBtn>
          </div>
        ))}
      </div>
      {active && rows[active[0]]?.[active[1]] !== undefined && (
        <Proofread
          key={active.join("-")}
          value={rows[active[0]][active[1]]}
          onChange={(v) => setCell(active[0], active[1], v)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-7" onClick={() => onChange({ rows: [...rows, Array(cols).fill("")] })}>
          <Plus /> Строка
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 sm:h-7"
          disabled={cols >= 6}
          onClick={() => onChange({ rows: rows.map((r) => [...r, ""]) })}
        >
          <Plus /> Столбец
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 sm:h-7"
          disabled={cols <= 2}
          onClick={() => onChange({ rows: rows.map((r) => r.slice(0, -1)) })}
        >
          Убрать столбец
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground sm:min-h-7">
          <input type="checkbox" checked={b.header} onChange={(e) => onChange({ header: e.target.checked })} className="size-4 accent-primary" />
          Первая строка — заголовок
        </label>
      </div>
    </div>
  );
}

export function useBlocks(initial: Block[] = []) {
  return useState<Block[]>(initial);
}
