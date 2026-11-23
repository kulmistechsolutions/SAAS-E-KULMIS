"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Bus,
  Calculator,
  Check,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Crown,
  HeartPulse,
  Library,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Preset {
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}

/**
 * The jobs a school most often has besides teaching, grouped the way a
 * principal thinks of them. The Somali beside each is a hint only — what is
 * saved is the English title, so payroll and reports read the same in every
 * school.
 */
const GROUPS: { label: string; items: Preset[] }[] = [
  {
    label: "Administration",
    items: [
      { value: "Principal", hint: "Maamulaha", icon: Crown, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
      { value: "Deputy Principal", hint: "Ku-xigeenka maamulaha", icon: UserRoundCog, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
      { value: "Administrator", hint: "Maamule", icon: Briefcase, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
      { value: "Secretary", hint: "Xoghaye", icon: ClipboardList, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
      { value: "Receptionist", hint: "Soo dhaweeye", icon: ClipboardList, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    ],
  },
  {
    label: "Finance & Records",
    items: [
      { value: "Accountant", hint: "Xisaabiye", icon: Calculator, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
      { value: "Cashier", hint: "Khasnaji", icon: Calculator, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
      { value: "Librarian", hint: "Maktabadda", icon: Library, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
      { value: "IT Officer", hint: "Farsamada IT", icon: Monitor, tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
    ],
  },
  {
    label: "Support Staff",
    items: [
      { value: "Security Staff", hint: "Ilaalo", icon: ShieldCheck, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
      { value: "Cleaner", hint: "Nadiifiye", icon: Sparkles, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      { value: "Cook", hint: "Karis", icon: ChefHat, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
      { value: "Driver", hint: "Darawal", icon: Bus, tone: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
      { value: "Assistant", hint: "Caawiye", icon: UserRoundCog, tone: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
      { value: "Nurse", hint: "Kalkaaliye caafimaad", icon: HeartPulse, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
      { value: "Maintenance", hint: "Dayactir", icon: Wrench, tone: "bg-stone-500/10 text-stone-600 dark:text-stone-300" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);
const OTHER_TONE = "bg-primary/10 text-primary";

function presetFor(value: string): Preset | undefined {
  const v = value.trim().toLowerCase();
  return ALL.find((p) => p.value.toLowerCase() === v);
}

/**
 * Position picker: a searchable list of common school jobs with icons, the
 * titles this school already uses, and "Add" for anything else — so a job
 * the list does not name (a Qur'an supervisor, a lab assistant) is never
 * blocked.
 */
export function PositionPicker({
  value,
  onChange,
  existing = [],
  placeholder = "Choose a position",
}: {
  value: string;
  onChange: (v: string) => void;
  /** Titles already used in this school, offered alongside the presets. */
  existing?: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The school's own titles that are not presets (and not "Teacher", which
  // is a teacher record, not staff).
  const custom = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of existing) {
      const v = raw.trim();
      const k = v.toLowerCase();
      if (!v || k === "teacher" || presetFor(v) || seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [existing]);

  const q = query.trim().toLowerCase();
  const match = (s: string) => !q || s.toLowerCase().includes(q);
  const groups = [
    ...(custom.length
      ? [
          {
            label: "Used in this school",
            items: custom.map<Preset>((v) => ({ value: v, hint: "", icon: Briefcase, tone: OTHER_TONE })),
          },
        ]
      : []),
    ...GROUPS,
  ]
    .map((g) => ({ ...g, items: g.items.filter((p) => match(p.value) || match(p.hint)) }))
    .filter((g) => g.items.length > 0);
  const exact =
    !!q && [...ALL.map((p) => p.value), ...custom].some((v) => v.toLowerCase() === q);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  const current = value.trim() ? presetFor(value) : undefined;
  const CurrentIcon = current?.icon ?? Briefcase;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-background ps-2 pe-3 text-start text-sm outline-none transition-colors",
          "hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          open && "border-primary ring-2 ring-primary/20",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            value.trim() ? (current?.tone ?? OTHER_TONE) : "bg-muted text-muted-foreground",
          )}
        >
          <CurrentIcon className="h-4 w-4" />
        </span>
        <span className={cn("min-w-0 flex-1 truncate", !value.trim() && "text-muted-foreground")}>
          {value.trim() || placeholder}
          {current?.hint && (
            <span className="ms-1.5 text-xs text-muted-foreground">· {current.hint}</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 z-50 mt-1.5 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl sm:min-w-[300px]"
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    e.preventDefault();
                    const only = groups.flatMap((g) => g.items);
                    pick(only.length === 1 ? only[0]!.value : query.trim());
                  }
                }}
                placeholder="Search or type a new position…"
                className="h-9 w-full rounded-lg border bg-background ps-8 pe-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 scrollbar-slim">
            {groups.map((g) => (
              <div key={g.label} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((p) => {
                  const Icon = p.icon;
                  const selected = p.value.toLowerCase() === value.trim().toLowerCase();
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(p.value)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted",
                        selected && "bg-primary/5",
                      )}
                    >
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", p.tone)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.value}</span>
                        {p.hint && (
                          <span className="block truncate text-xs text-muted-foreground">{p.hint}</span>
                        )}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {groups.length === 0 && !q && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No positions.</p>
            )}

            {q && !exact && (
              <button
                type="button"
                onClick={() => pick(query.trim())}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-primary/40 px-2 py-2 text-start text-sm text-primary hover:bg-primary/5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  Add &ldquo;<span className="font-semibold">{query.trim()}</span>&rdquo;
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
