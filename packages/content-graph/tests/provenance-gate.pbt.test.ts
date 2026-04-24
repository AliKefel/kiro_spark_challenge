// Feature: content-graph-data-model
// Property-based tests for the Provenance Gate (Agency Guardrail Rule 1)
// and contradiction evidence requirements.

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { ConceptNodeSchema } from "../src/schemas/concept-node.schema.js";
import { RelationshipEdgeSchema } from "../src/schemas/relationship-edge.schema.js";
import { GraphBuilder } from "../src/builder/graph-builder.js";
import { arbConceptNode, arbEvidenceAnchor, arbContradictsEdge, arbContentGraph, arbRelationshipEdge } from "./arbitraries.js";
import { ContentGraphSchema } from "../src/schemas/content-graph.schema.js";

// ---------------------------------------------------------------------------
// Property 1: Provenance Gate — empty anchors always rejected
// Validates: Requirements 2.7, 2.8, 6.2, 6.5, 8.1, 8.6
// ---------------------------------------------------------------------------

describe("Provenance Gate — empty anchors always rejected", () => {
  it(
    // Feature: content-graph-data-model, Property 1
    "ConceptNode with empty evidenceAnchors is always rejected by schema and GraphBuilder",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) =>
              arbConceptNode(sourceIds).map((node) => ({
                ...node,
                evidenceAnchors: [],
              })),
            ),
          (input) => {
            // Schema must reject
            const schemaResult = ConceptNodeSchema.safeParse(input);
            if (schemaResult.success) return false;

            // GraphBuilder must also reject without mutating state
            const builderResult = new GraphBuilder().addNode(input);
            if (builderResult.ok) return false;

            return true;
          },
        ),
        { numRuns: 1000 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 2: Provenance Gate — valid anchors always accepted
// Validates: Requirements 2.1–2.7, 8.2
// ---------------------------------------------------------------------------

describe("Provenance Gate — valid anchors always accepted", () => {
  it(
    // Feature: content-graph-data-model, Property 2
    "ConceptNode with at least one valid EvidenceAnchor is always accepted by schema",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) => arbConceptNode(sourceIds)),
          (input) => {
            const result = ConceptNodeSchema.safeParse(input);
            return result.success === true;
          },
        ),
        { numRuns: 1000 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 3: Contradiction evidence — invalid "contradicts" edges always rejected
// Validates: Requirements 3.6, 3.7, 3.8, 8.3
// ---------------------------------------------------------------------------

describe("Contradiction evidence — invalid contradicts edges always rejected", () => {
  it(
    // Feature: content-graph-data-model, Property 3
    "contradicts edge with zero anchors, one anchor, or two anchors sharing the same sourceId is always rejected",
    () => {
      const invalidContradictsEdge = fc.oneof(
        // Case A: zero anchors
        fc.record({
          id: fc.uuidV(4),
          fromNodeId: fc.uuidV(4),
          toNodeId: fc.uuidV(4),
          type: fc.constant("contradicts" as const),
          confidence: fc.float({ min: 0, max: 1, noNaN: true }),
          evidenceAnchors: fc.constant([]),
        }),
        // Case B: exactly one anchor
        fc.uuidV(4).chain((sourceId) =>
          arbEvidenceAnchor([sourceId]).map((anchor) => ({
            id: crypto.randomUUID(),
            fromNodeId: crypto.randomUUID(),
            toNodeId: crypto.randomUUID(),
            type: "contradicts" as const,
            confidence: 0.5,
            evidenceAnchors: [anchor],
          })),
        ),
        // Case C: two anchors sharing the same sourceId
        fc.uuidV(4).chain((sourceId) =>
          fc
            .tuple(arbEvidenceAnchor([sourceId]), arbEvidenceAnchor([sourceId]))
            .map(([a, b]) => ({
              id: crypto.randomUUID(),
              fromNodeId: crypto.randomUUID(),
              toNodeId: crypto.randomUUID(),
              type: "contradicts" as const,
              confidence: 0.5,
              evidenceAnchors: [a, b],
            })),
        ),
      );

      fc.assert(
        fc.property(invalidContradictsEdge, (input) => {
          const result = RelationshipEdgeSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: 1000 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 4: Contradiction evidence — valid "contradicts" edges always accepted
// Validates: Requirements 3.6, 8.4
// ---------------------------------------------------------------------------

describe("Contradiction evidence — valid contradicts edges always accepted", () => {
  it(
    // Feature: content-graph-data-model, Property 4
    "contradicts edge with at least two EvidenceAnchors from distinct sources is always accepted",
    () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.uuidV(4), fc.uuidV(4), fc.uuidV(4), fc.uuidV(4))
            .chain(([s1, s2, n1, n2]) => arbContradictsEdge([n1, n2], s1, s2)),
          (input) => {
            const result = RelationshipEdgeSchema.safeParse(input);
            return result.success === true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 5: ContentGraph round-trip serialization
// Validates: Requirements 5.1–5.6, 7.1–7.4, 8.5
// ---------------------------------------------------------------------------

describe("ContentGraph round-trip serialization", () => {
  it(
    // Feature: content-graph-data-model, Property 5
    "serializing a valid ContentGraph to JSON and parsing it back produces a structurally equivalent ContentGraph",
    () => {
      fc.assert(
        fc.property(arbContentGraph, (graph) => {
          const json = JSON.stringify(graph);
          const parsed = ContentGraphSchema.safeParse(JSON.parse(json));

          if (!parsed.success) return false;

          // All node IDs preserved
          const nodeIdsPreserved = Object.keys(graph.nodes).every(
            (id) => parsed.data.nodes[id] !== undefined,
          );
          if (!nodeIdsPreserved) return false;

          // All edge IDs preserved
          const edgeIdsPreserved = Object.keys(graph.edges).every(
            (id) => parsed.data.edges[id] !== undefined,
          );
          if (!edgeIdsPreserved) return false;

          // All sourceIds preserved
          const sourceIdsPreserved = graph.sourceIds.every((id) =>
            parsed.data.sourceIds.includes(id),
          );
          if (!sourceIdsPreserved) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 6: Dangling edge references always rejected
// Validates: Requirements 5.4, 5.7, 6.7
// ---------------------------------------------------------------------------

describe("Dangling edge references always rejected", () => {
  it(
    // Feature: content-graph-data-model, Property 6
    "ContentGraph with an edge referencing a fromNodeId not in nodes is always rejected",
    () => {
      const arbGraphWithDanglingEdge = arbContentGraph.chain((graph) =>
        fc.uuidV(4).chain((danglingNodeId) =>
          fc
            .record({
              id: fc.uuidV(4),
              fromNodeId: fc.constant(danglingNodeId), // not in graph.nodes
              toNodeId: fc.constantFrom(...Object.keys(graph.nodes)),
              type: fc.constantFrom("causes" as const, "contains" as const),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
              evidenceAnchors: fc.constant([]),
            })
            .filter((danglingEdge) => graph.nodes[danglingEdge.fromNodeId] === undefined)
            .map((danglingEdge) => ({
              ...graph,
              edges: { ...graph.edges, [danglingEdge.id]: danglingEdge },
            })),
        ),
      );

      fc.assert(
        fc.property(arbGraphWithDanglingEdge, (input) => {
          return ContentGraphSchema.safeParse(input).success === false;
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 8: Builder immutability
// Validates: Requirements 6.8
// ---------------------------------------------------------------------------

describe("Builder immutability", () => {
  it(
    // Feature: content-graph-data-model, Property 8
    "addNode returns a new GraphBuilder instance and leaves the original unchanged",
    () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
            .chain((sourceIds) =>
              arbConceptNode(sourceIds).map((node) => ({
                sourceIds,
                node: { ...node, depth: "overview" as const },
              })),
            ),
          ({ sourceIds, node }) => {
            const original = new GraphBuilder().addSource(sourceIds[0]);
            const result = original.addNode(node);

            if (!result.ok) return false;

            // Must return a different object reference
            if (result.value === original) return false;

            // Original must remain unchanged — node must NOT appear in original's build
            const origBuild = original.build();
            if (!origBuild.ok) return false;

            if (origBuild.value.nodes[node.id] !== undefined) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
