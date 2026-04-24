import { describe, it, expect } from "vitest";
import { ConceptNodeSchema } from "../src/schemas/concept-node.schema.js";

// ---------------------------------------------------------------------------
// Shared UUIDs
// ---------------------------------------------------------------------------

const NODE_ID = "00000000-0000-4000-8000-000000000001";
const ANCHOR_ID = "00000000-0000-4000-8000-000000000002";
const SOURCE_ID = "00000000-0000-4000-8000-000000000003";
const ANCHOR_ID_2 = "00000000-0000-4000-8000-000000000004";
const SOURCE_ID_2 = "00000000-0000-4000-8000-000000000005";

// ---------------------------------------------------------------------------
// Reusable fixture — a valid EvidenceAnchor
// ---------------------------------------------------------------------------

const validAnchor = {
  id: ANCHOR_ID,
  sourceId: SOURCE_ID,
  locator: { type: "pdf" as const, page: 1 },
  excerpt: "A valid excerpt from the source material.",
};

const secondAnchor = {
  id: ANCHOR_ID_2,
  sourceId: SOURCE_ID_2,
  locator: { type: "video" as const, timestampSeconds: 42 },
  excerpt: "A second valid excerpt from a different source.",
};

// ---------------------------------------------------------------------------
// Base valid node — spread and override in individual tests
// ---------------------------------------------------------------------------

const baseNode = {
  id: NODE_ID,
  title: "Photosynthesis",
  definition: "The process by which plants convert light into energy.",
  depth: "standard" as const,
  tags: ["biology", "plants"],
  evidenceAnchors: [validAnchor],
};

// ---------------------------------------------------------------------------
// Valid node — single EvidenceAnchor — Requirement 2.7
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — valid node with one EvidenceAnchor", () => {
  it("accepts a fully valid node with a single EvidenceAnchor", () => {
    const result = ConceptNodeSchema.safeParse(baseNode);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Valid node — multiple EvidenceAnchors — Requirement 2.7
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — valid node with multiple EvidenceAnchors", () => {
  it("accepts a node with two EvidenceAnchors", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      evidenceAnchors: [validAnchor, secondAnchor],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Provenance Gate — empty evidenceAnchors rejected — Requirements 2.7, 2.8
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — Provenance Gate", () => {
  it("rejects a node with an empty evidenceAnchors array", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      evidenceAnchors: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// title boundary values — Requirements 2.2, 2.9
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — title boundaries", () => {
  it("accepts title of length 1 (minimum valid)", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, title: "A" });
    expect(result.success).toBe(true);
  });

  it("accepts title of length 120 (maximum valid)", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, title: "A".repeat(120) });
    expect(result.success).toBe(true);
  });

  it("rejects title of length 121 (one over maximum)", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, title: "A".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, title: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// expandedExplanation boundary values — Requirements 2.4, 2.10
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — expandedExplanation boundaries", () => {
  it("accepts expandedExplanation of length 1 (minimum valid)", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      expandedExplanation: "A",
    });
    expect(result.success).toBe(true);
  });

  it("accepts expandedExplanation of length 800 (maximum valid)", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      expandedExplanation: "A".repeat(800),
    });
    expect(result.success).toBe(true);
  });

  it("rejects expandedExplanation of length 801 (one over maximum)", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      expandedExplanation: "A".repeat(801),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a node with expandedExplanation omitted entirely (field is optional)", () => {
    const { expandedExplanation: _omitted, ...nodeWithoutExplanation } = {
      ...baseNode,
      expandedExplanation: "ignored",
    };
    const result = ConceptNodeSchema.safeParse(nodeWithoutExplanation);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// depth enum values — Requirements 2.5, 2.7
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — depth enum", () => {
  it('accepts depth "overview"', () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, depth: "overview" });
    expect(result.success).toBe(true);
  });

  it('accepts depth "standard"', () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, depth: "standard" });
    expect(result.success).toBe(true);
  });

  it('accepts depth "deep"', () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, depth: "deep" });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid depth string (e.g. "expert")', () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, depth: "expert" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// id — UUID validation — Requirement 2.1
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — id field", () => {
  it("rejects a non-UUID id", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// definition — non-empty string — Requirement 2.3
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — definition field", () => {
  it("rejects an empty definition", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, definition: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tags — array of strings, may be empty — Requirement 2.6
// ---------------------------------------------------------------------------

describe("ConceptNodeSchema — tags field", () => {
  it("accepts an empty tags array", () => {
    const result = ConceptNodeSchema.safeParse({ ...baseNode, tags: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a tags array with multiple strings", () => {
    const result = ConceptNodeSchema.safeParse({
      ...baseNode,
      tags: ["biology", "chemistry", "energy"],
    });
    expect(result.success).toBe(true);
  });
});
