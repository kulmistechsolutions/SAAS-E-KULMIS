import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Saved ID-card layouts for a school.
 *
 * Card designs used to live in one admin's browser, so a layout drawn on the
 * office PC did not exist for anyone else. They are stored per school and keyed
 * by the client's "style|orientation|WxH" key, because a layout laid out for a
 * 54×86mm portrait card is meaningless on an 86×54mm landscape one.
 */

/** Mirrors the client's CardElement. Unknown keys are dropped, not trusted. */
const elementSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(["text", "field", "photo", "logo", "qr", "signature", "box", "line"]),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().nonnegative(),
    text: z.string().max(200).optional(),
    field: z.string().max(40).optional(),
    fontSize: z.number().finite().positive().max(72).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    valign: z.enum(["top", "middle", "bottom"]).optional(),
    color: z.string().max(32).optional(),
    bg: z.string().max(32).optional(),
    borderColor: z.string().max(32).optional(),
    borderWidth: z.number().finite().nonnegative().max(20).optional(),
    radius: z.number().finite().nonnegative().max(50).optional(),
    uppercase: z.boolean().optional(),
    letterSpacing: z.number().finite().optional(),
    mono: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    locked: z.boolean().optional(),
  })
  .strip();

export const saveCardDesignSchema = z.object({
  designKey: z.string().min(1).max(120),
  styleId: z.string().min(1).max(60),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
  accent: z.string().min(1).max(32),
  width: z.number().finite().positive().max(400),
  height: z.number().finite().positive().max(400),
  // A card is a few dozen elements; the cap stops a malformed client turning
  // one row into megabytes of JSON.
  elements: z.array(elementSchema).max(200),
});

export type SaveCardDesignInput = z.infer<typeof saveCardDesignSchema>;

export interface StoredCardDesign {
  designKey: string;
  styleId: string;
  orientation: string;
  accent: string;
  width: number;
  height: number;
  elements: unknown[];
  updatedAt: string;
}

@Injectable()
export class CardDesignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(schoolId: string): Promise<StoredCardDesign[]> {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardDesign.findMany({ orderBy: { updatedAt: "desc" } }),
    );
    return rows.map((r) => {
      const payload = (r.elements ?? {}) as { elements?: unknown[]; width?: number; height?: number };
      return {
        designKey: r.designKey,
        styleId: r.styleId,
        orientation: r.orientation,
        accent: r.accent,
        width: payload.width ?? 0,
        height: payload.height ?? 0,
        elements: payload.elements ?? [],
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async save(
    schoolId: string,
    userId: string | undefined,
    input: SaveCardDesignInput,
  ): Promise<{ designKey: string }> {
    // Width/height travel with the elements so a stored layout can be checked
    // against the card it was drawn for before being applied.
    const payload = {
      width: input.width,
      height: input.height,
      elements: input.elements,
    };
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardDesign.upsert({
        where: { schoolId_designKey: { schoolId, designKey: input.designKey } },
        create: {
          schoolId,
          designKey: input.designKey,
          styleId: input.styleId,
          orientation: input.orientation,
          accent: input.accent,
          elements: payload,
          updatedByUserId: userId ?? null,
        },
        update: {
          styleId: input.styleId,
          orientation: input.orientation,
          accent: input.accent,
          elements: payload,
          updatedByUserId: userId ?? null,
        },
      }),
    );
    return { designKey: input.designKey };
  }

  /** Reset one layout back to its built-in preset. */
  async remove(schoolId: string, designKey: string): Promise<{ removed: number }> {
    const res = await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardDesign.deleteMany({ where: { designKey } }),
    );
    return { removed: res.count };
  }
}
