"use client";

import { Select } from "@/components/ui/select";
import { useAcademicYearSelect } from "@/lib/academics/year-select";

interface Props {
  value?: string;
  onChange: (year: string) => void;
  className?: string;
  allowAll?: boolean;
  allLabel?: string;
}

/** Dropdown bound to API-backed academic years. */
export function AcademicYearSelect({
  value,
  onChange,
  className,
  allowAll,
  allLabel = "All years",
}: Props) {
  const { year: defaultYear, years } = useAcademicYearSelect();
  const selected = value ?? defaultYear;

  return (
    <Select
      className={className}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowAll && <option value="">{allLabel}</option>}
      {years.length === 0 ? (
        <option value="">Loading…</option>
      ) : (
        years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))
      )}
    </Select>
  );
}
