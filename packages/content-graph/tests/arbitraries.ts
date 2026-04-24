import * as fc from "fast-check";
import type { Locator, EvidenceAnchor } from "../src/schemas/evidence-anchor.schema.js";
import type { ConceptNode } from "../src/schemas/concept-node.schema.js";
import type { RelationshipEdge } from "../src/schemas/relationship-edge.schema.js";
import type { ContentGraph } from "../src/schemas/content-graph.schema.js";

// ---------------------------------------------------------------------------
// arbLocator
// ---------------------------------------------------------------------------

export const arbLocator: fc.Arbitrary<Locator> = fc.oneof(
  fc.record({
    type: fc.constant("pdf" as const),
    page: fc.integer({ min: 1, max: 10000 }),
  }),
  fc.record({
    type: fc.constant("video" as const),
    timestampSeconds: fc.float({ min: 0, max: 7200, noNaN: true }),
  }),
  fc.record({
    type: fc.constant("image" as const),
    region: fc.record({
      x: fc.float({ min: 0, max: 1000, noNaN: true }),
      y: fc.float({ min: 0, max: 1000, noNaN: true }),
      width: fc.float({ min: 0, max: 1000, noNaN: true }),
      height: fc.float({ min: 0, max: 1000, noNaN: true }),
    }),
  }),
);

// ---------------------------------------------------------------------------
// arbEvidenceAnchor
// ---------------------------------------------------------------------------

export const arbEvidenceAnchor = (sourceIds?: string[]): fc.Arbitrary<EvidenceAnchor> => {
  const sourceIdArb =
    sourceIds !== undefined && sourceIds.length > 0
      ? fc.constantFrom(...sourceIds)
      : fc.uuidV(4);

  return fc.record({
    id: fc.uuidV(4),
    sourceId: sourceIdArb,
    locator: arbLocator,
    excerpt: fc.string({ minLength: 1, maxLength: 300 }),
  });
};

// ---------------------------------------------------------------------------
// arbConceptNode
// ---------------------------------------------------------------------------

export const arbConceptNode = (sourceIds: string[]): fc.Arbitrary<ConceptNode> =>
  fc.record({
    id: fc.uuidV(4),
    title: fc.string({ minLength: 1, maxLength: 120 }),
    definition: fc.string({ minLength: 1, maxLength: 500 }),
    expandedExplanation: fc.option(fc.string({ minLength: 1, maxLength: 800 }), {
      nil: undefined,
    }),
    depth: fc.constantFrom("overview" as const, "standard" as const, "deep" as const),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 0,
      maxLength: 5,
    }),
    evidenceAnchors: fc.array(arbEvidenceAnchor(sourceIds), {
      minLength: 1,
      maxLength: 3,
    }),
  });

// ---------------------------------------------------------------------------
// arbRelationshipEdge  (excludes "contradicts")
// ---------------------------------------------------------------------------

export const arbRelationshipEdge = (
  nodeIds: string[],
  sourceIds: string[],
): fc.Arbitrary<RelationshipEdge> =>
  fc.record({
    id: fc.uuidV(4),
    fromNodeId: fc.constantFrom(...nodeIds),
    toNodeId: fc.constantFrom(...nodeIds),
    type: fc.constantFrom(
      "causes" as const,
      "contains" as const,
      "exemplifies" as const,
      "depends-on" as const,
      "elaborates" as const,
    ),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
    evidenceAnchors: fc.array(arbEvidenceAnchor(sourceIds), {
      minLength: 0,
      maxLength: 2,
    }),
  });

// ---------------------------------------------------------------------------
// arbContradictsEdge  (exactly "contradicts", anchors from two distinct sources)
// ---------------------------------------------------------------------------

export const arbContradictsEdge = (
  nodeIds: string[],
  sourceId1: string,
  sourceId2: string,
): fc.Arbitrary<RelationshipEdge> =>
  fc
    .tuple(arbEvidenceAnchor([sourceId1]), arbEvidenceAnchor([sourceId2]))
    .chain(([a, b]) =>
      fc.record({
        id: fc.uuidV(4),
        fromNodeId: fc.constantFrom(...nodeIds),
        toNodeId: fc.constantFrom(...nodeIds),
        type: fc.constant("contradicts" as const),
        confidence: fc.float({ min: 0, max: 1, noNaN: true }),
        evidenceAnchors: fc.constant([a, b]),
      }),
    );

// ---------------------------------------------------------------------------
// arbOverviewNode  (helper — ConceptNode with depth forced to "overview")
// ---------------------------------------------------------------------------

const arbOverviewNode = (sourceIds: string[]): fc.Arbitrary<ConceptNode> =>
  arbConceptNode(sourceIds).map((node) => ({ ...node, depth: "overview" as const }));

// ---------------------------------------------------------------------------
// arbContentGraph
// ---------------------------------------------------------------------------

export const arbContentGraph: fc.Arbitrary<ContentGraph> = fc
  .array(fc.uuidV(4), { minLength: 1, maxLength: 2 })
  .chain((sourceIds) =>
    fc
      .array(arbOverviewNode(sourceIds), { minLength: 1, maxLength: 3 })
      .chain((nodes) => {
        const nodeIds = nodes.map((n) => n.id);
        const nodesRecord = Object.fromEntries(nodes.map((n) => [n.id, n]));
        return fc
          .array(arbRelationshipEdge(nodeIds, sourceIds), {
            minLength: 0,
            maxLength: 2,
          })
          .chain((edges) => {
            const edgesRecord = Object.fromEntries(edges.map((e) => [e.id, e]));
            return fc.uuidV(4).map((id) => ({
              id,
              nodes: nodesRecord,
              edges: edgesRecord,
              sourceIds,
            }));
          });
      }),
  );
