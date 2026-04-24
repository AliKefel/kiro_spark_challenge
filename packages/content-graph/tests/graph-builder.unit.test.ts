import { describe, it, expect } from "vitest";
import { GraphBuilder } from "../src/builder/graph-builder.js";
import type { ConceptNodeInput, RelationshipEdgeInput } from "../src/builder/graph-builder.js";
import type { EvidenceAnchor } from "../src/schemas/evidence-anchor.schema.js";

// ---------------------------------------------------------------------------
// Shared UUIDs — consistent set used across all tests
// ---------------------------------------------------------------------------

const SOURCE_ID_1 = "00000000-0000-4000-8000-000000000001";
const SOURCE_ID_2 = "00000000-0000-4000-8000-000000000002";

const NODE_ID_1 = "00000000-0000-4000-8000-000000000010";
const NODE_ID_2 = "00000000-0000-4000-8000-000000000011";
const NODE_ID_3 = "00000000-0000-4000-8000-000000000012";
const NODE_ID_DANGLING = "00000000-0000-4000-8000-000000000099";

const ANCHOR_ID_1 = "00000000-0000-4000-8000-000000000020";
const ANCHOR_ID_2 = "00000000-0000-4000-8000-000000000021";

const EDGE_ID_1 = "00000000-0000-4000-8000-000000000030";

// ---------------------------------------------------------------------------
// Reusable fixture helpers
// ---------------------------------------------------------------------------

/** A registered source UUID string */
const validSource = SOURCE_ID_1;

/** Returns a valid EvidenceAnchor with the given sourceId */
function validAnchor(sourceId: string, anchorId = ANCHOR_ID_1): EvidenceAnchor {
  return {
    id: anchorId,
    sourceId,
    locator: { type: "pdf", page: 1 },
    excerpt: "A valid excerpt from the source material.",
  };
}

/** Returns a valid "overview" ConceptNode */
function overviewNode(id: string, tags: string[], sourceId: string): ConceptNodeInput {
  return {
    id,
    title: "Overview Concept",
    definition: "A high-level overview of the concept.",
    depth: "overview",
    tags,
    evidenceAnchors: [validAnchor(sourceId)],
  };
}

/** Returns a valid "standard" ConceptNode */
function standardNode(id: string, tags: string[], sourceId: string): ConceptNodeInput {
  return {
    id,
    title: "Standard Concept",
    definition: "A standard-depth explanation of the concept.",
    depth: "standard",
    tags,
    evidenceAnchors: [validAnchor(sourceId)],
  };
}

/** Returns a valid "deep" ConceptNode */
function deepNode(id: string, tags: string[], sourceId: string): ConceptNodeInput {
  return {
    id,
    title: "Deep Concept",
    definition: "A deep-dive explanation of the concept.",
    depth: "deep",
    tags,
    evidenceAnchors: [validAnchor(sourceId)],
  };
}

/** Returns a valid "causes" RelationshipEdge with empty evidenceAnchors */
function validEdge(id: string, fromNodeId: string, toNodeId: string): RelationshipEdgeInput {
  return {
    id,
    fromNodeId,
    toNodeId,
    type: "causes",
    confidence: 0.9,
    evidenceAnchors: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Happy path — addSource → addNode → addEdge → build
// Requirements: 6.1–6.4
// ---------------------------------------------------------------------------

describe("GraphBuilder — happy path", () => {
  it("addSource().addNode().addEdge().build() returns { ok: true, value: ContentGraph }", () => {
    const tags = ["biology"];

    // Add source first so evidenceAnchor sourceIds are registered
    const b0 = new GraphBuilder().addSource(validSource);

    // Add overview node (no depth prerequisite needed)
    const r1 = b0.addNode(overviewNode(NODE_ID_1, tags, validSource));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Add standard node (overview prerequisite exists)
    const r2 = r1.value.addNode(standardNode(NODE_ID_2, tags, validSource));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    // Add an edge between the two nodes
    const r3 = r2.value.addEdge(validEdge(EDGE_ID_1, NODE_ID_1, NODE_ID_2));
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;

    // Build the graph
    const result = r3.value.build();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const graph = result.value;
    expect(graph.nodes[NODE_ID_1]).toBeDefined();
    expect(graph.nodes[NODE_ID_2]).toBeDefined();
    expect(graph.edges[EDGE_ID_1]).toBeDefined();
    expect(graph.sourceIds).toContain(validSource);
  });
});

// ---------------------------------------------------------------------------
// 2. Provenance Gate on addNode — empty evidenceAnchors
// Requirements: 6.2, 6.5, 2.7, 2.8
// ---------------------------------------------------------------------------

describe("GraphBuilder — Provenance Gate on addNode", () => {
  it("returns { ok: false } when evidenceAnchors is empty", () => {
    const builder = new GraphBuilder().addSource(validSource);
    const nodeWithNoAnchors: ConceptNodeInput = {
      ...overviewNode(NODE_ID_1, ["biology"], validSource),
      evidenceAnchors: [],
    };

    const result = builder.addNode(nodeWithNoAnchors);
    expect(result.ok).toBe(false);
  });

  it("does not mutate builder state on failure — build() on original still succeeds (empty graph)", () => {
    const builder = new GraphBuilder().addSource(validSource);
    const nodeWithNoAnchors: ConceptNodeInput = {
      ...overviewNode(NODE_ID_1, ["biology"], validSource),
      evidenceAnchors: [],
    };

    // Attempt the failing addNode
    const failResult = builder.addNode(nodeWithNoAnchors);
    expect(failResult.ok).toBe(false);

    // Original builder should still build successfully (empty graph)
    const buildResult = builder.build();
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    // The failed node must not appear in the graph
    expect(Object.keys(buildResult.value.nodes)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Contradicts edge rejection — lacks distinct-source anchors
// Requirements: 6.3, 6.6, 3.6, 3.7, 3.8
// ---------------------------------------------------------------------------

describe("GraphBuilder — contradicts edge rejection", () => {
  it("returns { ok: false } for a 'contradicts' edge with no evidenceAnchors", () => {
    const builder = new GraphBuilder().addSource(validSource);
    const contradictingEdge: RelationshipEdgeInput = {
      id: EDGE_ID_1,
      fromNodeId: NODE_ID_1,
      toNodeId: NODE_ID_2,
      type: "contradicts",
      confidence: 0.8,
      evidenceAnchors: [],
    };

    const result = builder.addEdge(contradictingEdge);
    expect(result.ok).toBe(false);
  });

  it("returns { ok: false } for a 'contradicts' edge with two anchors sharing the same sourceId", () => {
    const builder = new GraphBuilder().addSource(validSource);
    const contradictingEdge: RelationshipEdgeInput = {
      id: EDGE_ID_1,
      fromNodeId: NODE_ID_1,
      toNodeId: NODE_ID_2,
      type: "contradicts",
      confidence: 0.8,
      evidenceAnchors: [
        validAnchor(SOURCE_ID_1, ANCHOR_ID_1),
        validAnchor(SOURCE_ID_1, ANCHOR_ID_2), // same source — invalid
      ],
    };

    const result = builder.addEdge(contradictingEdge);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Dangling edge on build — fromNodeId or toNodeId not in nodes
// Requirements: 6.4, 6.7, 5.4, 5.7
// ---------------------------------------------------------------------------

describe("GraphBuilder — dangling edge on build", () => {
  it("returns { ok: false, error: [...] } listing the dangling reference violation", () => {
    const tags = ["biology"];
    const b0 = new GraphBuilder().addSource(validSource);

    // Add one valid overview node
    const r1 = b0.addNode(overviewNode(NODE_ID_1, tags, validSource));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Add an edge whose fromNodeId points to a UUID not in the builder's nodes
    const danglingEdge: RelationshipEdgeInput = {
      id: EDGE_ID_1,
      fromNodeId: NODE_ID_DANGLING, // not in nodes
      toNodeId: NODE_ID_1,
      type: "causes",
      confidence: 0.7,
      evidenceAnchors: [],
    };

    const r2 = r1.value.addEdge(danglingEdge);
    expect(r2.ok).toBe(true); // addEdge only validates the edge schema, not graph integrity
    if (!r2.ok) return;

    // build() should catch the dangling reference
    const buildResult = r2.value.build();
    expect(buildResult.ok).toBe(false);
    if (buildResult.ok) return;

    // The error array should mention the dangling reference
    expect(buildResult.error.length).toBeGreaterThan(0);
    const codes = buildResult.error.map((e) => e.code);
    expect(codes).toContain("DANGLING_REFERENCE");
  });
});

// ---------------------------------------------------------------------------
// 5. Depth progression — standard without overview
// Requirements: 4.3, 4.5
// ---------------------------------------------------------------------------

describe("GraphBuilder — depth progression: standard without overview", () => {
  it("returns { ok: false } with code DEPTH_PROGRESSION_VIOLATION when adding a 'standard' node without a prior 'overview' sharing a tag", () => {
    const builder = new GraphBuilder().addSource(validSource);

    // Attempt to add a standard node directly — no overview exists
    const result = builder.addNode(standardNode(NODE_ID_1, ["physics"], validSource));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("DEPTH_PROGRESSION_VIOLATION");
  });
});

// ---------------------------------------------------------------------------
// 6. Depth progression — deep without standard
// Requirements: 4.2, 4.4
// ---------------------------------------------------------------------------

describe("GraphBuilder — depth progression: deep without standard", () => {
  it("returns { ok: false } with code DEPTH_PROGRESSION_VIOLATION when adding a 'deep' node without a prior 'standard' sharing a tag", () => {
    const tags = ["physics"];
    const b0 = new GraphBuilder().addSource(validSource);

    // Add an overview node — but no standard node
    const r1 = b0.addNode(overviewNode(NODE_ID_1, tags, validSource));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Attempt to add a deep node — standard prerequisite is missing
    const result = r1.value.addNode(deepNode(NODE_ID_2, tags, validSource));
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("DEPTH_PROGRESSION_VIOLATION");
  });
});

// ---------------------------------------------------------------------------
// 7. Depth progression — overview always succeeds
// Requirements: 4.1, 4.6
// ---------------------------------------------------------------------------

describe("GraphBuilder — depth progression: overview always succeeds", () => {
  it("returns { ok: true } when adding an 'overview' node with no prior nodes in the graph", () => {
    const builder = new GraphBuilder().addSource(validSource);
    const result = builder.addNode(overviewNode(NODE_ID_1, ["chemistry"], validSource));
    expect(result.ok).toBe(true);
  });

  it("returns { ok: true } when adding an 'overview' node even when other overview nodes exist", () => {
    const tags = ["chemistry"];
    const b0 = new GraphBuilder().addSource(validSource);

    const r1 = b0.addNode(overviewNode(NODE_ID_1, tags, validSource));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Adding a second overview node with the same tags should still succeed
    const result = r1.value.addNode(overviewNode(NODE_ID_2, tags, validSource));
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Immutability — addNode returns a new object reference
// Requirements: 6.8
// ---------------------------------------------------------------------------

describe("GraphBuilder — immutability", () => {
  it("addNode returns a new builder instance (different object reference)", () => {
    const originalBuilder = new GraphBuilder().addSource(validSource);
    const result = originalBuilder.addNode(overviewNode(NODE_ID_1, ["math"], validSource));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The returned builder must be a different object
    expect(result.value).not.toBe(originalBuilder);
  });

  it("original builder does not include the node added to the returned builder", () => {
    const originalBuilder = new GraphBuilder().addSource(validSource);
    const result = originalBuilder.addNode(overviewNode(NODE_ID_1, ["math"], validSource));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Build the original — it should not contain the new node
    const originalBuild = originalBuilder.build();
    expect(originalBuild.ok).toBe(true);
    if (!originalBuild.ok) return;

    expect(originalBuild.value.nodes[NODE_ID_1]).toBeUndefined();

    // Build the returned builder — it should contain the new node
    const newBuild = result.value.build();
    expect(newBuild.ok).toBe(true);
    if (!newBuild.ok) return;

    expect(newBuild.value.nodes[NODE_ID_1]).toBeDefined();
  });

  it("addSource returns a new builder instance (different object reference)", () => {
    const originalBuilder = new GraphBuilder();
    const newBuilder = originalBuilder.addSource(validSource);
    expect(newBuilder).not.toBe(originalBuilder);
  });
});
