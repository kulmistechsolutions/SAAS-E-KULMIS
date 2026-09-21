import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A book has to read like a book.
 *
 * Two complaints, one screen. Pages came out grainy and soft, and every one of
 * them was tiled with the reader's name, id and the date — which a student
 * reads through for an hour at a time.
 *
 * Neither was the file. The PDF is vector and untouched; the reader was
 * drawing it at a third of the pixels the screen has, then stretching the
 * result to fit. And the watermark was hard-coded on, with no way for a school
 * lending its own textbooks to its own pupils to say otherwise.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const reader = readFileSync(
  join(WEB, "app", "library-portal", "read", "[id]", "page.tsx"),
  "utf8",
);
const service = readFileSync(join(__dirname, "library.service.ts"), "utf8");
const settings = readFileSync(
  join(WEB, "app", "(app)", "settings", "library", "page.tsx"),
  "utf8",
);

describe("pages are drawn at the screen's real resolution", () => {
  it("scales the render by the device pixel ratio", () => {
    expect(reader).toContain("window.devicePixelRatio");
    expect(reader).toContain("page.getViewport({ scale: scale * dpr })");
  });

  it("caps it, because the bitmap grows with the square of the ratio", () => {
    // A 300-page book on a 4x tablet would exhaust the tab.
    expect(reader).toContain("2.5,");
  });

  it("sizes the canvas to the rendered viewport, not the layout", () => {
    expect(reader).toContain("canvas.width = viewport.width;");
    expect(reader).toContain("canvas.height = viewport.height;");
  });
});

describe("the watermark is the school's choice", () => {
  it("comes back with the book, not from a second request", () => {
    // The reader needs it before it draws the first page; fetching it
    // separately means a page rendered once clean and once stamped.
    expect(service).toContain("studentWatermark: stored?.studentWatermark !== false");
    expect(service).toContain("librarySettings: true");
  });

  it("stays on for a school that has never chosen", () => {
    // `!== false` rather than `=== true`: a school with no setting at all
    // keeps exactly what it had before this existed.
    expect(service).toContain("!== false");
    expect(reader).toContain('book?.studentWatermark !== false');
  });

  it("is clamped to something readable at both ends", () => {
    expect(service).toContain("Math.min(0.3, Math.max(0.04, stored.watermarkOpacity))");
  });

  it("draws nothing at all when it is off", () => {
    // The label goes empty and the stamp is skipped, so there is one thing to
    // be wrong rather than two.
    expect(reader).toContain("if (watermarkLabel) {");
  });
});

describe("the school can see what it is choosing", () => {
  it("says what is lost by turning it off", () => {
    expect(settings).toContain("watermarkOffHelp");
    expect(settings).toContain("watermarkOnHelp");
  });

  it("shows the stamp at the chosen strength rather than a number", () => {
    expect(settings).toContain("settingsLibrary.previewStamp");
    expect(settings).toContain("opacity: draft.watermarkOpacity");
  });
});
