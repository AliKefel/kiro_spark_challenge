import { describe, it, expect } from "vitest";
import { RelationshipEdgeSchema } from "../src/schemas/relationship-edge.schema.js";

// ---------------------------------------------------------------------------
// Shared UUIDs
// ---------------------------------------------------------------------------

const EDGE_ID    = "00000000-0000-4000-8000-000000000001";
const FROM_ID    = "00000000-0000-4000-8000-000000000002";
const TO_ID      = "00000000-0000-4000-8000-000000000003";
const ANCHOR_ID_A = "00000000-0000-4000-8000-000000000004";
const SOURCE_ID_A = "00000000-0000-4000-8000-000000000005";
const ANCHOR_ID_B = "00000000-0000-4000-8000-000000000006";
const SOURCE_ID_B = "00000000-0000-4000-8000-000000000007";

// ---------------------------------------------------------------------------
// Reusable anchor fixtures — distinct sourceIds for contradicts invariant
// ---------------------------------------------------------------------------

const anchorA = {
  id: ANCHOR_ID_A,
  sourceId: SOURCE_ID_A,
  locator: { type: "pdf" as const, page: 1 },
  excerpt: "First source excerpt backing one side of the contradiction.",
};

const anchorB = {
  id: ANCHOR_ID_B,
  sourceId: SOURCE_ID_B,
  locator: { type: "video" as const, timestampSeconds: 30 },
  excerpt: "Second source excerpt backing the other side of the contradiction.",
};

// anchorB_sameSource shares SOURCE_ID_A — used to test the same-sourceId rejection
const anchorB_sameSource = {
  ...anchorB,
  sourceId: SOURCE_ID_A,
};

// ---------------------------------------------------------------------------
// Base valid edge — spread and override in individual tests
// ---------------------------------------------------------------------------

const baseEdge = {
  id: EDGE_ID,
  fromNodeId: FROM_ID,
  toNodeId: TO_ID,
  type: "causes" as const,
  confidence: 0.8,
  evidenceAnchors: [],
};

// ---------------------------------------------------------------------------
// All six edge types — valid inputs — Requirements 3.3, 3.5
// ---------------------------------------------------------------------------

describe("RelationshipEdgeSchema — all six edge types accepted", () => {
  it('accepts type "causes"', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "causes" });
    expect(result.success).toBe(true);
  });

  it('accepts type "contains"', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "contains" });
    expect(result.success).toBe(true);
  });

  it('accepts type "contradicts" with two anchors from distinct sources', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contradicts",
      evidenceAnchors: [anchorA, anchorB],
    });
    expect(result.success).toBe(true);
  });

  it('accepts type "exemplifies"', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "exemplifies" });
    expect(result.success).toBe(true);
  });

  it('accepts type "depends-on"', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "depends-on" });
    expect(result.success).toBe(true);
  });

  it('accepts type "elaborates"', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "elaborates" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// confidence boundary values — Requirements 3.4, 3.9
// ---------------------------------------------------------------------------

describe("RelationshipEdgeSchema — confidence boundaries", () => {
  it("accepts confidence = 0 (minimum valid)", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, confidence: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts confidence = 0.5 (midpoint valid)", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, confidence: 0.5 });
    expect(result.success).toBe(true);
  });

  it("accepts confidence = 1 (maximum valid)", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, confidence: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects confidence = -0.001 (just below minimum)", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, confidence: -0.001 });
    expect(result.success).toBe(false);
  });

  it("rejects confidence = 1.001 (just above maximum)", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, confidence: 1.001 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// "contradicts" edge — evidence invariant — Requirements 3.6, 3.7, 3.8
// ---------------------------------------------------------------------------

describe('RelationshipEdgeSchema — "contradicts" evidence invariant', () => {
  it("accepts two anchors from distinct sourceIds", () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contradicts",
      evidenceAnchors: [anchorA, anchorB],
    });
    expect(result.success).toBe(true);
  });

  it("rejects with only one anchor (fewer than two)", () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contradicts",
      evidenceAnchors: [anchorA],
    });
    expect(result.success).toBe(false);
  });

  it("rejects with zero anchors", () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contradicts",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects two anchors that share the same sourceId", () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contradicts",
      evidenceAnchors: [anchorA, anchorB_sameSource],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Non-"contradicts" edges — empty evidenceAnchors accepted — Requirement 3.5
// ---------------------------------------------------------------------------

describe("RelationshipEdgeSchema — non-contradicts edges accept empty evidenceAnchors", () => {
  it('accepts "causes" with empty evidenceAnchors', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "causes",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts "contains" with empty evidenceAnchors', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "contains",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts "exemplifies" with empty evidenceAnchors', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "exemplifies",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts "depends-on" with empty evidenceAnchors', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "depends-on",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts "elaborates" with empty evidenceAnchors', () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...baseEdge,
      type: "elaborates",
      evidenceAnchors: [],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UUID validation — id, fromNodeId, toNodeId — Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe("RelationshipEdgeSchema — UUID field validation", () => {
  it("rejects a non-UUID id", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID fromNodeId", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, fromNodeId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID toNodeId", () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, toNodeId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invalid edge type string rejected — Requirement 3.3
// ---------------------------------------------------------------------------

describe("RelationshipEdgeSchema — invalid edge type rejected", () => {
  it('rejects an unknown type string (e.g. "supports")', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "supports" });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string as type', () => {
    const result = RelationshipEdgeSchema.safeParse({ ...baseEdge, type: "" });
    expect(result.success).toBe(false);
  });
});
