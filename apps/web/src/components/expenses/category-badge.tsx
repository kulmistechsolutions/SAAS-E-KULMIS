import { cn } from "@/lib/utils";
import { categoryColor } from "@/lib/expenses/format";

export function CategoryBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        categoryColor(name),
      )}
    >
      {name}
    </span>
  );
}
