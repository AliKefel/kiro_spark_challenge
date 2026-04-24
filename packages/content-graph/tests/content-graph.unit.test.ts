import { describe, it, expect } from "vitest";
import { ContentGraphSchema } from "../src/schemas/content-graph.schema.js";

// ---------------------------------------------------------------------------
// Shared UUIDs
// ---------------------------------------------------------------------------

const GRAPH_ID          = "00000000-0000-4000-8000-000000000001";
const NODE_ID_1         = "00000000-0000-4000-8000-000000000002";
const NODE_ID_2         = "00000000-0000-4000-8000-000000000003";
const EDGE_ID           = "00000000-0000-4000-8000-000000000004";
const ANCHOR_ID         = "00000000-0000-4000-8000-000000000005";
const SOURCE_ID         = "00000000-0000-4000-8000-000000000006";
const UNKNOWN_NODE_ID   = "00000000-0000-4000-8000-000000000099"; // not in nodes
const UNKNOWN_SOURCE_ID = "00000000-0000-4000-8000-000000000098"; // not in sourceIds

// ---------------------------------------------------------------------------
// Reusable fixtures
// ---------------------------------------------------------------------------

/** A valid EvidenceAnchor whose sourceId is registered in the graph's sourceIds. */
const validAnchor = {
  id: ANCHOR_ID,
  sourceId: SOURCE_ID,
  locator: { type: "pdf" as const, page: 1 },
  excerpt: "A valid excerpt from the source material.",
};

/** A valid ConceptNode with one registered EvidenceAnchor. */
const validNode = {
  id: NODE_ID_1,
  title: "Photosynthesis",
  definition: "The process by which plants convert light into energy.",
  depth: "standard" as const,
  tags: ["biology"],
  evidenceAnchors: [validAnchor],
};

/** A second valid ConceptNode (used when an edge needs two distinct nodes). */
const validNode2 = {
  id: NODE_ID_2,
  title: "Cellular Respiration",
  definition: "The process by which cells break down glucose to release energy.",
  depth: "standard" as const,
  tags: ["biology"],
  evidenceAnchors: [validAnchor],
};

/** A valid edge connecting NODE_ID_1 → NODE_ID_2. */
const validEdge = {
  id: EDGE_ID,
  fromNodeId: NODE_ID_1,
  toNodeId: NODE_ID_2,
  type: "causes" as const,
  confidence: 0.9,
  evidenceAnchors: [],
};

// ---------------------------------------------------------------------------
// 1. Valid minimal graph — one node, no edges — Requirements 5.1–5.3, 5.5
// ---------------------------------------------------------------------------

describe("ContentGraphSchema — valid minimal graph (one node, no edges)", () => {
  it("accepts a graph with one node and an empty edges record", () => {
    const result = ContentGraphSchema.safeParse({
      id: GRAPH_ID,
      nodes: { [NODE_ID_1]: validNode },
      edges: {},
      sourceIds: [SOURCE_ID],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Valid graph — one node and one edge — Requirements 5.1–5.6
// ---------------------------------------------------------------------------

describe("ContentGraphSchema — valid graph with one node and one edge", () => {
  it("accepts a graph where the edge's fromNodeId and toNodeId both exist in nodes", () => {
    const result = ContentGraphSchema.safeParse({
      id: GRAPH_ID,
      nodes: {
        [NODE_ID_1]: validNode,
        [NODE_ID_2]: validNode2,
      },
      edges: { [EDGE_ID]: validEdge },
      sourceIds: [SOURCE_ID],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Dangling fromNodeId reference rejected — Requirements 5.4, 5.7
// ---------------------------------------------------------------------------

describe("ContentGraphSchema — dangling fromNodeId reference", () => {
  it("rejects a graph where an edge's fromNodeId is not present in nodes", () => {
    const danglingFromEdge = {
      ...validEdge,
      fromNodeId: UNKNOWN_NODE_ID, // not in nodes
    };

    const result = ContentGraphSchema.safeParse({
      id: GRAPH_ID,
      nodes: { [NODE_ID_2]: validNode2 },
      edges: { [EDGE_ID]: danglingFromEdge },
      sourceIds: [SOURCE_ID],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const hasDanglingCode = result.error.issues.some(
        (issue) => (issue as { params?: { code?: string } }).params?.code === "DANGLING_REFERENCE"
      );
      expect(hasDanglingCode).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Dangling toNodeId reference rejected — Requirements 5.4, 5.7
// ---------------------------------------------------------------------------

describe("ContentGraphSchema — dangling toNodeId reference", () => {
  it("rejects a graph where an edge's toNodeId is not present in nodes", () => {
    const danglingToEdge = {
      ...validEdge,
      toNodeId: UNKNOWN_NODE_ID, // not in nodes
    };

    const result = ContentGraphSchema.safeParse({
      id: GRAPH_ID,
      nodes: { [NODE_ID_1]: validNode },
      edges: { [EDGE_ID]: danglingToEdge },
      sourceIds: [SOURCE_ID],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const hasDanglingCode = result.error.issues.some(
        (issue) => (issue as { params?: { code?: string } }).params?.code === "DANGLING_REFERENCE"
      );
      expect(hasDanglingCode).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. EvidenceAnchor with unregistered sourceId rejected — Requirements 5.6, 5.8
// ---------------------------------------------------------------------------

describe("ContentGraphSchema — EvidenceAnchor with unregistered sourceId", () => {
  it("rejects a graph where a node's anchor references a sourceId not in sourceIds", () => {
    const anchorWithUnknownSource = {
      ...validAnchor,
      sourceId: UNKNOWN_SOURCE_ID, // not in sourceIds
    };

    const nodeWithUnknownSource = {
      ...validNode,
      evidenceAnchors: [anchorWithUnknownSource],
    };

    const result = ContentGraphSchema.safeParse({
      id: GRAPH_ID,
      nodes: { [NODE_ID_1]: nodeWithUnknownSource },
      edges: {},
      sourceIds: [SOURCE_ID], // UNKNOWN_SOURCE_ID is absent
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const hasUnregisteredCode = result.error.issues.some(
        (issue) => (issue as { params?: { code?: string } }).params?.code === "UNREGISTERED_SOURCE"
      );
      expect(hasUnregisteredCode).toBe(true);
    }
  });
});
