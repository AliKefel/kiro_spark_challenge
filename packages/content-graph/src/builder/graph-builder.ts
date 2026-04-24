import { z } from "zod";
import {
  ConceptNodeSchema,
  type ConceptNode,
} from "../schemas/concept-node.schema.js";
import {
  RelationshipEdgeSchema,
  type RelationshipEdge,
} from "../schemas/relationship-edge.schema.js";
import {
  ContentGraphSchema,
  type ContentGraph,
} from "../schemas/content-graph.schema.js";
import { mapZodError, type ValidationError } from "../schemas/validation-error.js";

// ---------------------------------------------------------------------------
// Result discriminated union
// ---------------------------------------------------------------------------

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// ---------------------------------------------------------------------------
// Input types — full objects including `id` (builder accepts complete entities)
// ---------------------------------------------------------------------------

export type ConceptNodeInput = z.infer<typeof ConceptNodeSchema>;
export type RelationshipEdgeInput = z.infer<typeof RelationshipEdgeSchema>;

// ---------------------------------------------------------------------------
// GraphBuilder — immutable fluent builder
// ---------------------------------------------------------------------------

export class GraphBuilder {
  private readonly sourceIds: ReadonlySet<string>;
  private readonly nodes: Readonly<Record<string, ConceptNode>>;
  private readonly edges: Readonly<Record<string, RelationshipEdge>>;

  constructor(
    sourceIds: ReadonlySet<string> = new Set(),
    nodes: Readonly<Record<string, ConceptNode>> = {},
    edges: Readonly<Record<string, RelationshipEdge>> = {},
  ) {
    this.sourceIds = sourceIds;
    this.nodes = nodes;
    this.edges = edges;
  }

  /**
   * Registers a source UUID and returns a new GraphBuilder with the source added.
   * If the provided sourceId is not a valid UUID, returns the current builder unchanged.
   *
   * Requirements: 6.1
   */
  addSource(sourceId: string): GraphBuilder {
    const parsed = z.string().uuid().safeParse(sourceId);
    if (!parsed.success) {
      return this;
    }
    return new GraphBuilder(
      new Set([...this.sourceIds, sourceId]),
      this.nodes,
      this.edges,
    );
  }

  /**
   * Validates the node against ConceptNodeSchema and depth progression rules,
   * then returns a new GraphBuilder with the node added on success.
   *
   * Requirements: 6.2, 6.5, 4.1–4.6
   */
  addNode(node: ConceptNodeInput): Result<GraphBuilder, ValidationError> {
    // 1. Schema validation
    const parsed = ConceptNodeSchema.safeParse(node);
    if (!parsed.success) {
      const errors = mapZodError(parsed.error);
      return { ok: false, error: errors[0] };
    }

    const validNode = parsed.data;

    // 2. Belt-and-suspenders Provenance Gate check
    if (validNode.evidenceAnchors.length === 0) {
      return {
        ok: false,
        error: {
          code: "PROVENANCE_GATE_VIOLATION",
          message: "ConceptNode must have at least one EvidenceAnchor.",
          path: ["evidenceAnchors"],
        },
      };
    }

    // 3. Depth progression check (Requirement 4)
    const depthError = this.checkDepthProgression(validNode);
    if (depthError !== null) {
      return { ok: false, error: depthError };
    }

    return {
      ok: true,
      value: new GraphBuilder(
        this.sourceIds,
        { ...this.nodes, [validNode.id]: validNode },
        this.edges,
      ),
    };
  }

  /**
   * Validates the edge against RelationshipEdgeSchema, then returns a new
   * GraphBuilder with the edge added on success.
   *
   * Requirements: 6.3, 6.6
   */
  addEdge(edge: RelationshipEdgeInput): Result<GraphBuilder, ValidationError> {
    const parsed = RelationshipEdgeSchema.safeParse(edge);
    if (!parsed.success) {
      const errors = mapZodError(parsed.error);
      return { ok: false, error: errors[0] };
    }

    const validEdge = parsed.data;

    return {
      ok: true,
      value: new GraphBuilder(
        this.sourceIds,
        this.nodes,
        { ...this.edges, [validEdge.id]: validEdge },
      ),
    };
  }

  /**
   * Runs full ContentGraphSchema validation and returns either a valid
   * ContentGraph or a list of all validation errors.
   *
   * Requirements: 6.4, 6.7
   */
  build(): Result<ContentGraph, ValidationError[]> {
    const graph = {
      id: crypto.randomUUID(),
      nodes: this.nodes,
      edges: this.edges,
      sourceIds: [...this.sourceIds],
    };

    const parsed = ContentGraphSchema.safeParse(graph);
    if (!parsed.success) {
      return { ok: false, error: mapZodError(parsed.error) };
    }

    return { ok: true, value: parsed.data };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Checks the depth progression invariant for the incoming node.
   * Returns a ValidationError if the prerequisite depth is missing, or null if OK.
   *
   * Rules:
   *   "overview" → no prerequisite
   *   "standard" → requires at least one existing "overview" node sharing a tag
   *   "deep"     → requires at least one existing "standard" node sharing a tag
   */
  private checkDepthProgression(node: ConceptNode): ValidationError | null {
    if (node.depth === "overview") {
      return null;
    }

    const existingNodes = Object.values(this.nodes);

    if (node.depth === "standard") {
      const hasPrerequisite = existingNodes.some(
        (existing) =>
          existing.depth === "overview" &&
          node.tags.some((tag) => existing.tags.includes(tag)),
      );
      if (!hasPrerequisite) {
        return {
          code: "DEPTH_PROGRESSION_VIOLATION",
          message:
            "A 'standard' node requires a prior 'overview' node sharing at least one tag.",
          path: ["depth"],
        };
      }
    }

    if (node.depth === "deep") {
      const hasPrerequisite = existingNodes.some(
        (existing) =>
          existing.depth === "standard" &&
          node.tags.some((tag) => existing.tags.includes(tag)),
      );
      if (!hasPrerequisite) {
        return {
          code: "DEPTH_PROGRESSION_VIOLATION",
          message:
            "A 'deep' node requires a prior 'standard' node sharing at least one tag.",
          path: ["depth"],
        };
      }
    }

    return null;
  }
}
