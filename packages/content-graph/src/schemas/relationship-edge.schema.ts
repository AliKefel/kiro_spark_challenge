import { z } from "zod";
import { EvidenceAnchorSchema } from "./evidence-anchor.schema.js";

export const EdgeTypeSchema = z.enum([
  "causes",
  "contains",
  "contradicts",
  "exemplifies",
  "depends-on",
  "elaborates",
]);

export const RelationshipEdgeSchema = z
  .object({
    id: z.string().uuid(),
    fromNodeId: z.string().uuid(),
    toNodeId: z.string().uuid(),
    type: EdgeTypeSchema,
    confidence: z.number().min(0).max(1),
    evidenceAnchors: z.array(EvidenceAnchorSchema),
  })
  .superRefine((edge, ctx) => {
    if (edge.type === "contradicts") {
      const distinctSources = new Set(edge.evidenceAnchors.map((a) => a.sourceId));
      if (edge.evidenceAnchors.length < 2 || distinctSources.size < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A 'contradicts' edge requires at least two EvidenceAnchors from distinct sources.",
          path: ["evidenceAnchors"],
          params: { code: "CONTRADICTION_EVIDENCE_INSUFFICIENT" },
        });
      }
    }
  });

export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;
