import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A school's own letterhead banner: uploaded and cropped by the school,
 * printed full width across the top of every document.
 */
const svc = readFileSync(join(__dirname, "settings.service.ts"), "utf8");
const ctl = readFileSync(join(__dirname, "settings.controller.ts"), "utf8");
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

describe("the letterhead banner", () => {
  it("is uploaded and removed by administrators only", () => {
    for (const route of ['@Post("header-image")', '@Delete("header-image")']) {
      const at = ctl.indexOf(route);
      const head = ctl.slice(ctl.lastIndexOf("@Roles", at), at);
      expect(head).toContain("UserRole.ADMINISTRATOR");
      expect(head).toContain('"settings.update"');
    }
  });

  it("refuses a file over 3 MB", () => {
    expect(svc).toContain("if (buffer.length > HEADER_IMAGE_MAX_BYTES)");
  });

  it("reaches parents' printouts through the public branding", () => {
    expect(svc).toContain("headerImageKey: true,\n        headerImageHeightMm: true,");
  });

  it("replaces the generated header on both header builders when switched on", () => {
    const header = read("lib", "print", "header.ts");
    const letterhead = read("lib", "print", "letterhead.ts");
    expect(header).toContain("const banner = bannerHtml();");
    expect(letterhead).toContain("const head = banner ?? `<div class=\"lh\">");
    const store = read("lib", "settings", "store.ts");
    expect(store).toContain("s.school.headerImageEnabled && s.school.headerImageUrl");
  });

  it("prints at the chosen height without stretching", () => {
    const header = read("lib", "print", "header.ts");
    expect(header).toContain("object-fit:contain");
    expect(header).toContain('style="height:${b.heightMm}mm"');
  });

  it("is cropped in the browser from the original pixels", () => {
    const card = read("components", "settings", "header-banner-card.tsx");
    expect(card).toContain("ctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h");
  });
});
