import type { PlatformDashboard } from "@/lib/platform/types";
import { Building2, GraduationCap, Users, UserCheck, Ban } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CARDS: {
  key: keyof PlatformDashboard;
  label: string;
  icon: LucideIcon;
  chip: string;
}[] = [
  { key: "totalSchools", label: "Total Schools", icon: Building2, chip: "bg-violet-500/15 text-violet-400" },
  { key: "activeSchools", label: "Active Schools", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-400" },
  { key: "suspendedSchools", label: "Suspended", icon: Ban, chip: "bg-rose-500/15 text-rose-400" },
  { key: "totalStudents", label: "Total Students", icon: GraduationCap, chip: "bg-sky-500/15 text-sky-400" },
  { key: "totalTeachers", label: "Total Teachers", icon: Users, chip: "bg-amber-500/15 text-amber-400" },
  { key: "totalParents", label: "Total Parents", icon: Users, chip: "bg-teal-500/15 text-teal-400" },
];

export function PlatformSummaryCards({ summary }: { summary: PlatformDashboard }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
        >
          <span className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", c.chip)}>
            <c.icon className="h-4 w-4" />
          </span>
          <p className="text-2xl font-bold tabular-nums text-white">{summary[c.key].toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-slate-400">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
