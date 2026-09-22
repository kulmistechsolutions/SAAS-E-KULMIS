"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ARABIC_FONTS,
  fontStack,
  HIGHLIGHT_COLORS,
  resolveDirection,
  richTextToPlain,
  RICH_TEXT_SIZES,
  sanitizeRichText,
  type DirectionSetting,
} from "@ekulmis/shared";
import { Bold, Eraser, Highlighter, Italic, Type, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

/**
 * A formatted question, shown.
 *
 * The HTML has already been sanitised on the server before it was stored, and
 * is sanitised again here before it is rendered. Twice, because the two guard
 * different things: the server decides what may be stored, and this decides
 * what this page will show — including content that was stored before a rule
 * changed, or that arrived from anywhere other than our own write path.
 */
export function RichText({
  html,
  text,
  direction,
  quizDirection,
  font,
  quizFont,
  as: Tag = "span",
  className,
}: {
  html?: string | null;
  text: string;
  direction?: DirectionSetting | null;
  quizDirection?: DirectionSetting | null;
  font?: string | null;
  quizFont?: string | null;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  className?: string;
}) {
  // Direction follows the words, not the markup — the tags would otherwise
  // count as Latin letters and turn an Arabic question left-to-right.
  const plain = html ? richTextToPlain(html) || text : text;
  const dir = resolveDirection(direction ?? quizDirection ?? "AUTO", plain);
  const family = fontStack(font ?? quizFont);

  const style: CSSProperties = {};
  if (family) style.fontFamily = family;
  if (dir === "rtl") style.lineHeight = 1.9;

  const classes = cn(dir === "rtl" && "text-right", "quiz-rich", className);

  if (!html) {
    return (
      <Tag dir={dir} style={style} className={classes}>
        {text}
      </Tag>
    );
  }
  return (
    <Tag
      dir={dir}
      style={style}
      className={classes}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}

/**
 * The wording for each size and colour the shared list offers.
 *
 * Spelled out rather than built from the id, so that adding one to the list
 * without translating it is a build error instead of a key printed at a
 * teacher in place of a word.
 */
const SIZE_KEY = {
  "80%": "richText.size_80",
  "100%": "richText.size_100",
  "125%": "richText.size_125",
  "150%": "richText.size_150",
  "200%": "richText.size_200",
} as const satisfies Record<(typeof RICH_TEXT_SIZES)[number]["id"], string>;

const COLOR_KEY = {
  "#fef08a": "richText.color_yellow",
  "#bbf7d0": "richText.color_green",
  "#bfdbfe": "richText.color_blue",
  "#fecaca": "richText.color_red",
  "#e9d5ff": "richText.color_purple",
} as const satisfies Record<(typeof HIGHLIGHT_COLORS)[number]["id"], string>;

type Cmd =
  | { kind: "bold" }
  | { kind: "italic" }
  | { kind: "underline" }
  | { kind: "size"; value: string }
  | { kind: "font"; value: string }
  | { kind: "highlight"; value: string }
  | { kind: "clear" };

/**
 * The box a teacher writes a question in.
 *
 * Deliberately small: bold, italic, underline, a size, a face and a
 * highlight. That is what a paper needs — a verse set larger than the
 * sentence asking about it, one letter of a word marked — and every button
 * here produces something the sanitiser is known to keep, so nothing a
 * teacher does silently disappears on save.
 *
 * The plain words are reported alongside the markup on every keystroke,
 * because they are what the paper is really asking and what grading, the
 * change history and every export read.
 */
export function RichTextEditor({
  html,
  text,
  onChange,
  placeholder,
  direction,
  quizDirection,
  font,
  quizFont,
  rows = 2,
  disabled,
  compact,
}: {
  html?: string | null;
  text: string;
  onChange: (next: { text: string; html: string | null }) => void;
  placeholder?: string;
  direction?: DirectionSetting | null;
  quizDirection?: DirectionSetting | null;
  font?: string | null;
  quizFont?: string | null;
  rows?: number;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // Written by us, so a re-render caused by our own onChange does not reset
  // the caret to the start of the box on every keystroke.
  const ours = useRef(false);

  const dir = resolveDirection(
    direction ?? quizDirection ?? "AUTO",
    (html ? richTextToPlain(html) : "") || text,
  );
  const family = fontStack(font ?? quizFont);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (ours.current) {
      ours.current = false;
      return;
    }
    const next = html ? sanitizeRichText(html) : escapeForBox(text);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [html, text]);

  const emit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    ours.current = true;
    const clean = sanitizeRichText(el.innerHTML);
    const plain = richTextToPlain(clean);
    onChange({ text: plain, html: clean && clean !== escapeForBox(plain) ? clean : null });
  }, [onChange]);

  const run = (cmd: Cmd) => {
    const el = box.current;
    if (!el || disabled) return;
    el.focus();
    // execCommand is deprecated and still the only thing every browser here
    // implements for applying a mark to a selection. What it produces is
    // sanitised on the way out, so its habit of emitting <font> tags and
    // inline styles of its own costs nothing.
    switch (cmd.kind) {
      case "bold":
      case "italic":
      case "underline":
        document.execCommand(cmd.kind);
        break;
      case "clear":
        document.execCommand("removeFormat");
        break;
      case "size":
      case "font":
      case "highlight":
        wrapSelection(
          cmd.kind === "size"
            ? `font-size:${cmd.value}`
            : cmd.kind === "font"
              ? `font-family:${fontStack(cmd.value) ?? cmd.value}`
              : `background-color:${cmd.value}`,
        );
        break;
    }
    emit();
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-background transition-colors",
        focused && "border-primary",
        disabled && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b px-1.5 py-1">
        <Mark onRun={() => run({ kind: "bold" })} title={t("richText.bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Mark>
        <Mark onRun={() => run({ kind: "italic" })} title={t("richText.italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Mark>
        <Mark onRun={() => run({ kind: "underline" })} title={t("richText.underline")}>
          <Underline className="h-3.5 w-3.5" />
        </Mark>

        <span className="mx-0.5 h-5 w-px bg-border" />

        <Picker
          title={t("richText.size")}
          icon={<Type className="h-3.5 w-3.5" />}
          onPick={(v) => run({ kind: "size", value: v })}
          items={RICH_TEXT_SIZES.map((s) => ({
            id: s.id,
            label: t(SIZE_KEY[s.id]),
          }))}
        />
        {!compact && (
          <Picker
            title={t("richText.font")}
            icon={<span className="text-[11px] font-semibold">Aa</span>}
            onPick={(v) => run({ kind: "font", value: v })}
            items={[
              { id: "", label: t("quiz.fontDefault") },
              ...ARABIC_FONTS.map((f) => ({ id: f.id, label: f.label })),
            ]}
          />
        )}
        <Picker
          title={t("richText.highlight")}
          icon={<Highlighter className="h-3.5 w-3.5" />}
          onPick={(v) => run({ kind: "highlight", value: v })}
          items={HIGHLIGHT_COLORS.map((c) => ({
            id: c.id,
            label: t(COLOR_KEY[c.id]),
            swatch: c.id,
          }))}
        />

        <span className="mx-0.5 h-5 w-px bg-border" />

        <Mark onRun={() => run({ kind: "clear" })} title={t("richText.clear")}>
          <Eraser className="h-3.5 w-3.5" />
        </Mark>
      </div>

      <div
        ref={box}
        contentEditable={!disabled}
        suppressContentEditableWarning
        dir={dir}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? ""}
        onInput={emit}
        onBlur={() => {
          setFocused(false);
          emit();
        }}
        onFocus={() => setFocused(true)}
        // A question is one block of text; a paste that brings its own
        // headings and links in is flattened by the sanitiser anyway, and
        // this stops the box jumping about while that happens.
        onPaste={(e) => {
          e.preventDefault();
          const plain = e.clipboardData.getData("text/html");
          const fallback = e.clipboardData.getData("text/plain");
          document.execCommand(
            "insertHTML",
            false,
            plain ? sanitizeRichText(plain) : escapeForBox(fallback),
          );
          emit();
        }}
        style={{
          minHeight: `${Math.max(1, rows) * 1.6 + 1}rem`,
          ...(family ? { fontFamily: family } : {}),
          ...(dir === "rtl" ? { lineHeight: 1.9 } : {}),
        }}
        className={cn(
          "quiz-rich w-full px-3 py-2 text-sm outline-none",
          "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          dir === "rtl" && "text-right",
        )}
      />
    </div>
  );
}

/** Plain text, as the box should hold it. */
function escapeForBox(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/**
 * Wrap what is selected in a span carrying one declaration.
 *
 * `execCommand("fontSize")` only speaks in the seven legacy sizes and
 * `"hiliteColor"` is not supported everywhere, so the selection is wrapped
 * directly. Nothing is selected, nothing happens — which is the right
 * answer, and better than silently formatting the whole question.
 */
function wrapSelection(declaration: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.setAttribute("style", declaration);
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(span);
    sel.addRange(after);
  } catch {
    // A selection across element boundaries that cannot be surrounded. The
    // teacher sees nothing happen rather than losing what they had selected.
  }
}

function Mark({
  onRun,
  title,
  children,
}: {
  onRun: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // The selection has to survive the click, and a button takes focus on
      // mousedown — which collapses it before the command can run.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Picker({
  title,
  icon,
  items,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; label: string; swatch?: string }[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <span className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-7 min-w-7 items-center justify-center rounded px-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          open && "bg-secondary text-foreground",
        )}
      >
        {icon}
      </button>
      {open && (
        <span
          className="absolute z-30 mt-1 flex min-w-36 flex-col rounded-lg border bg-popover p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.id || "default"}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(it.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-start text-xs hover:bg-secondary"
            >
              {it.swatch && (
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded border"
                  style={{ backgroundColor: it.swatch }}
                />
              )}
              {it.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
