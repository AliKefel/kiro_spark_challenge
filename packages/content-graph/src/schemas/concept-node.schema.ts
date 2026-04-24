import { z } from "zod";
import { EvidenceAnchorSchema } from "./evidence-anchor.schema.js";

export const DepthSchema = z.enum(["overview", "standard", "deep"]);

export const ConceptNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  definition: z.string().min(1),
  expandedExplanation: z.string().min(1).max(800).optional(),
  depth: DepthSchema,
  tags: z.array(z.string()),
  evidenceAnchors: z.array(EvidenceAnchorSchema).min(1), // Provenance Gate — Agency Guardrail Rule 1
});

export type Depth = z.infer<typeof DepthSchema>;
export type ConceptNode = z.infer<typeof ConceptNodeSchema>;
