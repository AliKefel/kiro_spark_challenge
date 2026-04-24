import { z } from "zod";

export const LocatorSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pdf"),
    page: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("video"),
    timestampSeconds: z.number().min(0),
  }),
  z.object({
    type: z.literal("image"),
    region: z.object({
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
    }),
  }),
]);

export const EvidenceAnchorSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  locator: LocatorSchema,
  excerpt: z.string().min(1).max(300),
});

export type Locator = z.infer<typeof LocatorSchema>;
export type EvidenceAnchor = z.infer<typeof EvidenceAnchorSchema>;
