import { saveCardDesignSchema } from "./card-designs.service";

/**
 * A school asked to put its letterhead banner on the ID card and size it.
 * The banner is an "image" element carrying the picture, how it fits its box
 * and its proportions; the server must keep all three, not strip them.
 */
const base = {
  designKey: "classic|PORTRAIT|54x86",
  styleId: "classic",
  orientation: "PORTRAIT" as const,
  accent: "#1e3a8a",
  width: 54,
  height: 86,
};

describe("an uploaded banner on an ID card", () => {
  it("is accepted with its picture, fit and proportions", () => {
    const r = saveCardDesignSchema.safeParse({
      ...base,
      elements: [
        { id: "img-1", type: "image", x: 0, y: 0, w: 54, h: 11.5, src: "data:image/png;base64,AAAA", fit: "contain", ratio: 4.7 },
        { id: "logo-1", type: "logo", x: 2, y: 2, w: 8, h: 8, src: "data:image/png;base64,BBBB", fit: "cover" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.elements[0]).toMatchObject({ type: "image", fit: "contain", ratio: 4.7 });
      expect(r.data.elements[1]).toMatchObject({ type: "logo", fit: "cover" });
    }
  });

  it("refuses a fit it does not know", () => {
    const r = saveCardDesignSchema.safeParse({
      ...base,
      elements: [{ id: "img-1", type: "image", x: 0, y: 0, w: 54, h: 10, fit: "zoom" }],
    });
    expect(r.success).toBe(false);
  });
});
