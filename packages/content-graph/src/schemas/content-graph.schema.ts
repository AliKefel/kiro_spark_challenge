import { z } from "zod";
import { ConceptNodeSchema } from "./concept-node.schema.js";
import { RelationshipEdgeSchema } from "./relationship-edge.schema.js";

export const ContentGraphSchema = z
  .object({
    id: z.string().uuid(),
    nodes: z.record(z.string().uuid(), ConceptNodeSchema),
    edges: z.record(z.string().uuid(), RelationshipEdgeSchema),
    sourceIds: z.array(z.string().uuid()),
  })
  .superRefine((graph, ctx) => {
    // 1. Dangling reference check: every edge's fromNodeId and toNodeId must exist in nodes
    for (const [edgeId, edge] of Object.entries(graph.edges)) {
      if (!graph.nodes[edge.fromNodeId]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge ${edgeId}: fromNodeId ${edge.fromNodeId} not found in nodes.`,
          path: ["edges", edgeId, "fromNodeId"],
          params: { code: "DANGLING_REFERENCE" },
        });
      }
      if (!graph.nodes[edge.toNodeId]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge ${edgeId}: toNodeId ${edge.toNodeId} not found in nodes.`,
          path: ["edges", edgeId, "toNodeId"],
          params: { code: "DANGLING_REFERENCE" },
        });
      }
    }

    // 2. Source registration check: every evidenceAnchor's sourceId must be in sourceIds
    const registeredSources = new Set(graph.sourceIds);

    // Check anchors on nodes
    for (const node of Object.values(graph.nodes)) {
      for (const anchor of node.evidenceAnchors) {
        if (!registeredSources.has(anchor.sourceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `EvidenceAnchor references unregistered sourceId: ${anchor.sourceId}`,
            path: ["nodes", node.id, "evidenceAnchors"],
            params: { code: "UNREGISTERED_SOURCE" },
          });
        }
      }
    }

    // Check anchors on edges
    for (const [edgeId, edge] of Object.entries(graph.edges)) {
      for (const anchor of edge.evidenceAnchors) {
        if (!registeredSources.has(anchor.sourceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `EvidenceAnchor on edge ${edgeId} references unregistered sourceId: ${anchor.sourceId}`,
            path: ["edges", edgeId, "evidenceAnchors"],
            params: { code: "UNREGISTERED_SOURCE" },
          });
        }
      }
    }
  });

export type ContentGraph = z.infer<typeof ContentGraphSchema>;
