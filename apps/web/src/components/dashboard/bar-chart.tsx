interface Point {
  label: string;
  value: number;
}

/** Lightweight dependency-free bar chart. */
export function BarChart({
  data,
  color = "hsl(var(--primary))",
}: {
  data: Point[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-40 items-end gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-700 ease-out"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? "4px" : "0",
                background: color,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

interface GroupedPoint {
  label: string;
  income: number;
  expense: number;
}

/** Two-series grouped bar chart (income vs expense). */
export function GroupedBarChart({ data }: { data: GroupedPoint[] }) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div
                className="w-1/2 rounded-t-md bg-emerald-500 transition-all duration-700 ease-out"
                style={{
                  height: `${(d.income / max) * 100}%`,
                  minHeight: d.income > 0 ? "4px" : "0",
                }}
                title={`Income: ${d.income}`}
              />
              <div
                className="w-1/2 rounded-t-md bg-rose-500 transition-all duration-700 ease-out"
                style={{
                  height: `${(d.expense / max) * 100}%`,
                  minHeight: d.expense > 0 ? "4px" : "0",
                }}
                title={`Expense: ${d.expense}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Expense
        </span>
      </div>
    </div>
  );
}
