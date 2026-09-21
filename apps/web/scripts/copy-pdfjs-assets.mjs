// Put pdf.js's own font and encoding data where the browser can fetch it.
//
// A PDF may use one of the fourteen standard fonts — Helvetica, Times, Courier
// and the rest — without embedding them, on the understanding that the reader
// supplies them. pdf.js ships substitutes for exactly that case, but only uses
// them if it is told where they are. Told nothing, it falls back to whatever
// font the browser happens to have, which is why a textbook came out in the
// wrong typeface with the wrong spacing: not a quality setting, a different
// font.
//
// The cmaps are the same story for text that is not plain Latin — Arabic,
// CJK, anything using a CID encoding. Without them the glyphs are looked up in
// the wrong table.
//
// Copied into public/ at build time rather than imported, because these are
// hundreds of small files fetched on demand for the fonts a given book
// actually uses; bundling them all would be megabytes nobody reads.
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const from = join(web, "node_modules", "pdfjs-dist");
const to = join(web, "public", "pdfjs");

if (!existsSync(from)) {
  console.warn("[pdfjs] package not installed; skipping asset copy");
  process.exit(0);
}

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });

for (const dir of ["standard_fonts", "cmaps"]) {
  const src = join(from, dir);
  if (!existsSync(src)) {
    console.warn(`[pdfjs] ${dir} missing from pdfjs-dist; skipping`);
    continue;
  }
  await cp(src, join(to, dir), { recursive: true });
  console.log(`[pdfjs] copied ${dir}`);
}
