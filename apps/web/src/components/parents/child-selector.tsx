"use client";

import { cn } from "@/lib/utils";
import type { Student } from "@/lib/students/types";

interface Props {
  students: Student[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Child selector for families with multiple students. */
export function ChildSelector({ students, selectedId, onChange, className }: Props) {
  if (students.length <= 1) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {students.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            selectedId === c.id
              ? "border-primary bg-primary/10 text-primary"
              : "hover:bg-secondary",
          )}
        >
          <span className="font-medium">{c.fullName}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {c.className}{c.section ? ` - ${c.section}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
