/** Parse CSV text into rows of string fields (handles quoted commas and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      if (c === "\r") i++;
    } else if (c !== "\r") {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Map parsed CSV rows to objects using column keys; skips empty data rows. */
export function csvToObjects<T extends Record<string, string | undefined>>(
  text: string,
  columns: (keyof T)[],
): { headers: string[]; rows: T[]; headerError?: string } {
  const parsed = parseCsv(text.trim());
  if (parsed.length === 0) {
    return { headers: [], rows: [], headerError: "File is empty." };
  }

  const headers = parsed[0]!.map((h) => h.trim());
  const rows = parsed
    .slice(1)
    .map((line) => {
      const obj = {} as T;
      columns.forEach((col, idx) => {
        obj[col] = (line[idx] ?? "").trim() as T[keyof T];
      });
      return obj;
    })
    .filter((r) => Object.values(r).some((v) => String(v).trim()));

  return { headers, rows };
}

export function headersMatch(
  headers: string[],
  expected: string[],
): string | undefined {
  const norm = headers.map(normalizeHeader);
  const missing = expected.filter(
    (h) => !norm.includes(normalizeHeader(h)),
  );
  if (missing.length > 0) {
    return `Missing column(s): ${missing.join(", ")}. Expected: ${expected.join(", ")}.`;
  }
  return undefined;
}

export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 6;
}
