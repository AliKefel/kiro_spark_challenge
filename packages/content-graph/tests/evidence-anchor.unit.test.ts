import { describe, it, expect } from "vitest";
import { EvidenceAnchorSchema } from "../src/schemas/evidence-anchor.schema.js";

const VALID_UUID_1 = "00000000-0000-4000-8000-000000000001";
const VALID_UUID_2 = "00000000-0000-4000-8000-000000000002";

const baseAnchor = {
  id: VALID_UUID_1,
  sourceId: VALID_UUID_2,
  excerpt: "A valid excerpt.",
};

// ---------------------------------------------------------------------------
// Locator variants — valid inputs
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — pdf locator", () => {
  it("accepts a valid pdf locator with page >= 1", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("EvidenceAnchorSchema — video locator", () => {
  it("accepts a valid video locator with timestampSeconds = 0", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "video", timestampSeconds: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid video locator with a positive timestampSeconds", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "video", timestampSeconds: 120.5 },
    });
    expect(result.success).toBe(true);
  });
});

describe("EvidenceAnchorSchema — image locator", () => {
  it("accepts a valid image locator with all region values = 0", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: 0, y: 0, width: 0, height: 0 } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid image locator with positive region values", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: 10, y: 20, width: 100, height: 50 } },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// excerpt boundary values — Requirements 1.4, 1.5
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — excerpt boundaries", () => {
  it("accepts excerpt of length 1 (minimum valid)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
      excerpt: "A",
    });
    expect(result.success).toBe(true);
  });

  it("accepts excerpt of length 300 (maximum valid)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
      excerpt: "A".repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it("rejects excerpt of length 301 (one over maximum)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
      excerpt: "A".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty excerpt", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
      excerpt: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pdf locator — page boundary values — Requirements 1.3, 1.6
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — pdf page boundaries", () => {
  it("accepts page = 1 (minimum valid)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects page = 0 (below minimum)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "pdf", page: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// video locator — timestampSeconds boundary values — Requirements 1.3, 1.7
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — video timestampSeconds boundaries", () => {
  it("accepts timestampSeconds = 0 (minimum valid)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "video", timestampSeconds: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects timestampSeconds = -1 (negative)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "video", timestampSeconds: -1 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// image locator — region boundary values — Requirement 1.3
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — image region boundaries", () => {
  it("rejects a negative x value (-0.001)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: -0.001, y: 0, width: 10, height: 10 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative y value (-0.001)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: 0, y: -0.001, width: 10, height: 10 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative width value (-0.001)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: 0, y: 0, width: -0.001, height: 10 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative height value (-0.001)", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      locator: { type: "image", region: { x: 0, y: 0, width: 10, height: -0.001 } },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// id and sourceId — UUID validation — Requirements 1.1, 1.2
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — id field", () => {
  it("rejects a non-UUID id", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      id: "not-a-uuid",
      locator: { type: "pdf", page: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("EvidenceAnchorSchema — sourceId field", () => {
  it("rejects a non-UUID sourceId", () => {
    const result = EvidenceAnchorSchema.safeParse({
      ...baseAnchor,
      sourceId: "not-a-uuid",
      locator: { type: "pdf", page: 1 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------

describe("EvidenceAnchorSchema — missing required fields", () => {
  it("rejects input missing id", () => {
    const { id: _id, ...withoutId } = { ...baseAnchor, locator: { type: "pdf" as const, page: 1 } };
    const result = EvidenceAnchorSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejects input missing sourceId", () => {
    const { sourceId: _sourceId, ...withoutSourceId } = { ...baseAnchor, locator: { type: "pdf" as const, page: 1 } };
    const result = EvidenceAnchorSchema.safeParse(withoutSourceId);
    expect(result.success).toBe(false);
  });

  it("rejects input missing locator", () => {
    const result = EvidenceAnchorSchema.safeParse({ ...baseAnchor });
    expect(result.success).toBe(false);
  });

  it("rejects input missing excerpt", () => {
    const { excerpt: _excerpt, ...withoutExcerpt } = { ...baseAnchor, locator: { type: "pdf" as const, page: 1 } };
    const result = EvidenceAnchorSchema.safeParse(withoutExcerpt);
    expect(result.success).toBe(false);
  });
});
