import {
  BarChart3,
  CalendarCheck,
  DollarSign,
  FileText,
  GraduationCap,
  Layers,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Each category's look: its icon, the tint of its icon tile, and the soft
 * wash in the card's top corner. Classes are written out in full so Tailwind
 * keeps them.
 */
export const REPORT_THEME: Record<
  string,
  { icon: LucideIcon; tile: string; wash: string }
> = {
  students: {
    icon: Users,
    tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    wash: "from-blue-400/25",
  },
  teachers: {
    icon: GraduationCap,
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    wash: "from-violet-400/25",
  },
  attendance: {
    icon: CalendarCheck,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    wash: "from-emerald-400/25",
  },
  fees: {
    icon: Layers,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    wash: "from-amber-400/30",
  },
  examinations: {
    icon: FileText,
    tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    wash: "from-rose-400/25",
  },
  promotions: {
    icon: TrendingUp,
    tile: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    wash: "from-fuchsia-400/25",
  },
  salary: {
    icon: Wallet,
    tile: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    wash: "from-teal-400/25",
  },
  expenses: {
    icon: BarChart3,
    tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    wash: "from-sky-400/25",
  },
  financial: {
    icon: DollarSign,
    tile: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    wash: "from-indigo-400/25",
  },
  quiz: {
    icon: Trophy,
    tile: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    wash: "from-orange-400/25",
  },
};
export const REPORT_THEME_FALLBACK = REPORT_THEME.students!;
