import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A book has to be shown in its own type.
 *
 * The complaint after the sharpness fix was not sharpness: "farta iyo
 * qoraalkanba isbadalay" — the letterforms and the spacing had changed. They
 * had. A PDF may use one of the fourteen standard fonts (Helvetica, Times,
 * Courier) without embedding them, on the understanding that the reader
 * supplies them. pdf.js ships substitutes for exactly that case and only
 * reaches for them if it is told where they are; told nothing, it falls back
 * to whatever font the browser happens to have.
 *
 * So a textbook set in Times came out in something else, with different
 * metrics and different line breaks. Not a quality setting — a different font.
 * The cmaps are the same story for anything not plain Latin.
 */
const WEB = join(__dirname, "..", "..", "..", "web");
const reader = readFileSync(
  join(WEB, "src", "app", "library-portal", "read", "[id]", "page.tsx"),
  "utf8",
);
const pkg = JSON.parse(
  readFileSync(join(WEB, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("pdf.js is told where its own font data lives", () => {
  it("passes the standard-font directory", () => {
    expect(reader).toContain('standardFontDataUrl: "/pdfjs/standard_fonts/"');
  });

  it("passes the character maps, packed", () => {
    expect(reader).toContain('cMapUrl: "/pdfjs/cmaps/"');
    expect(reader).toContain("cMapPacked: true");
  });

  it("refuses to substitute a system font of the same name", () => {
    // The page must be this PDF's type, not the machine's.
    expect(reader).toContain("useSystemFonts: false");
  });
});

describe("the font data is actually shipped", () => {
  it("is copied by the build command itself, not a lifecycle hook", () => {
    // pnpm does not run pre/post scripts by default, so a `prebuild` hook
    // would quietly not happen inside the Docker build — and the fonts would
    // 404 in production while working perfectly on a developer's machine.
    expect(pkg.scripts.build).toContain("copy-pdfjs-assets.mjs");
    expect(pkg.scripts.build).toContain("next build");
    expect(pkg.scripts.dev).toContain("copy-pdfjs-assets.mjs");
  });

  it("has a copier that survives a missing package", () => {
    const script = readFileSync(
      join(WEB, "scripts", "copy-pdfjs-assets.mjs"),
      "utf8",
    );
    expect(script).toContain("standard_fonts");
    expect(script).toContain("cmaps");
    // A build should not die because the copy step found nothing.
    expect(script).toContain("process.exit(0)");
  });

  it("does not commit the copied assets", () => {
    // Hundreds of small files regenerated on every build.
    const ignore = join(WEB, "public", ".gitignore");
    expect(existsSync(ignore)).toBe(true);
    expect(readFileSync(ignore, "utf8")).toContain("pdfjs/");
  });
});
