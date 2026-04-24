# Requirements Document

## Introduction

The content graph data model is the foundational layer of Lattice. It defines the in-memory and persisted representation of learning material extracted from multiple source types (PDFs, videos, images). The graph is composed of three entity types — ConceptNode, RelationshipEdge, and EvidenceAnchor — and enforces hard structural invariants that implement the Agency Guardrail (Rule 1: Provenance Gate). All entities are validated with Zod schemas at every input boundary. A builder API provides a safe, ergonomic way to construct graphs from parsed source data. Property-based tests using fast-check prove that the Provenance Gate cannot be bypassed under any input.

---

## Glossary

- **ContentGraph**: The top-level container holding all ConceptNodes, RelationshipEdges, and the index of source materials for a single learning session.
- **ConceptNode**: A single discrete idea extracted from source material, always backed by at least one EvidenceAnchor.
- **RelationshipEdge**: A directed, typed connection between two ConceptNodes, expressing a semantic relationship.
- **EvidenceAnchor**: A pointer to the exact location in a source document that backs a claim in a ConceptNode or RelationshipEdge.
- **Locator**: A discriminated union describing the position within a source — page number for PDFs, timestamp in seconds for videos, or bounding-box coordinates for images.
- **Depth**: An ordered enum (`"overview"` < `"standard"` < `"deep"`) representing the level of detail at which a concept is explained.
- **Provenance Gate**: Agency Guardrail Rule 1 — a hard runtime constraint that prevents any ConceptNode from existing or rendering without at least one valid EvidenceAnchor.
- **Builder API**: A fluent, validated API for constructing ContentGraph instances from parsed source data, enforcing all structural invariants at construction time.
- **Zod Schema**: A TypeScript-first runtime validation schema used at every input boundary.
- **fast-check**: A property-based testing library used to prove guardrail invariants hold for all possible inputs.
- **Vitest**: The unit test runner used for all TypeScript tests.
- **Prisma**: The ORM used to persist ContentGraph entities to SQLite (local dev) or Postgres (production).

---

## Requirements

### Requirement 1: EvidenceAnchor Entity

**User Story:** As a developer building the ingest pipeline, I want a validated EvidenceAnchor type that points to an exact source location, so that every claim in the graph can be traced back to its origin.

#### Acceptance Criteria

1. THE `EvidenceAnchor_Schema` SHALL validate that every EvidenceAnchor has a non-empty `id` field of type UUID.
2. THE `EvidenceAnchor_Schema` SHALL validate that every EvidenceAnchor has a non-empty `sourceId` field of type UUID referencing the originating source document.
3. THE `EvidenceAnchor_Schema` SHALL validate that the `locator` field is a discriminated union with exactly three variants: `{ type: "pdf"; page: number }` where `page >= 1`, `{ type: "video"; timestampSeconds: number }` where `timestampSeconds >= 0`, and `{ type: "image"; region: { x: number; y: number; width: number; height: number } }` where all region values are non-negative.
4. THE `EvidenceAnchor_Schema` SHALL validate that the `excerpt` field is a string of 1–300 characters.
5. IF an EvidenceAnchor is constructed with an `excerpt` exceeding 300 characters, THEN THE `EvidenceAnchor_Schema` SHALL return a validation error identifying the field and constraint violated.
6. IF an EvidenceAnchor is constructed with a `locator` of type `"pdf"` and a `page` value less than 1, THEN THE `EvidenceAnchor_Schema` SHALL return a validation error.
7. IF an EvidenceAnchor is constructed with a `locator` of type `"video"` and a negative `timestampSeconds`, THEN THE `EvidenceAnchor_Schema` SHALL return a validation error.

---

### Requirement 2: ConceptNode Entity

**User Story:** As a developer building the content extraction pipeline, I want a validated ConceptNode type that captures a single learning idea with its metadata and provenance, so that the graph can represent discrete concepts reliably.

#### Acceptance Criteria

1. THE `ConceptNode_Schema` SHALL validate that every ConceptNode has a non-empty `id` field of type UUID.
2. THE `ConceptNode_Schema` SHALL validate that the `title` field is a string of 1–120 characters.
3. THE `ConceptNode_Schema` SHALL validate that the `definition` field is a non-empty string.
4. THE `ConceptNode_Schema` SHALL validate that the `expandedExplanation` field, when present, is a string of 1–800 characters.
5. THE `ConceptNode_Schema` SHALL validate that the `depth` field is one of the literal values `"overview"`, `"standard"`, or `"deep"`.
6. THE `ConceptNode_Schema` SHALL validate that the `tags` field is an array of strings (may be empty).
7. THE `ConceptNode_Schema` SHALL validate that the `evidenceAnchors` field is an array containing at least one valid EvidenceAnchor (Provenance Gate — Agency Guardrail Rule 1).
8. IF a ConceptNode is constructed with an empty `evidenceAnchors` array, THEN THE `ConceptNode_Schema` SHALL return a validation error identifying the Provenance Gate violation.
9. IF a ConceptNode is constructed with a `title` exceeding 120 characters, THEN THE `ConceptNode_Schema` SHALL return a validation error.
10. IF a ConceptNode is constructed with an `expandedExplanation` exceeding 800 characters, THEN THE `ConceptNode_Schema` SHALL return a validation error.

---

### Requirement 3: RelationshipEdge Entity

**User Story:** As a developer building the graph construction pipeline, I want a validated RelationshipEdge type that connects two ConceptNodes with a typed semantic relationship, so that the graph can express how concepts relate to one another.

#### Acceptance Criteria

1. THE `RelationshipEdge_Schema` SHALL validate that every RelationshipEdge has a non-empty `id` field of type UUID.
2. THE `RelationshipEdge_Schema` SHALL validate that `fromNodeId` and `toNodeId` are non-empty UUID strings.
3. THE `RelationshipEdge_Schema` SHALL validate that the `type` field is one of the literal values `"causes"`, `"contains"`, `"contradicts"`, `"exemplifies"`, `"depends-on"`, or `"elaborates"`.
4. THE `RelationshipEdge_Schema` SHALL validate that the `confidence` field is a number in the range [0, 1] inclusive.
5. THE `RelationshipEdge_Schema` SHALL validate that the `evidenceAnchors` field is an array (may be empty for non-`"contradicts"` edges).
6. WHEN a RelationshipEdge has `type` equal to `"contradicts"`, THE `RelationshipEdge_Schema` SHALL validate that `evidenceAnchors` contains at least two EvidenceAnchors with distinct `sourceId` values — one backing each side of the contradiction.
7. IF a RelationshipEdge with `type` `"contradicts"` is constructed with fewer than two EvidenceAnchors, THEN THE `RelationshipEdge_Schema` SHALL return a validation error identifying the contradiction evidence requirement.
8. IF a RelationshipEdge with `type` `"contradicts"` is constructed with two or more EvidenceAnchors that all share the same `sourceId`, THEN THE `RelationshipEdge_Schema` SHALL return a validation error indicating that both sides of the contradiction must be evidenced by distinct sources.
9. IF a RelationshipEdge is constructed with a `confidence` value outside [0, 1], THEN THE `RelationshipEdge_Schema` SHALL return a validation error.

---

### Requirement 4: Depth Progression Constraint

**User Story:** As a developer building the graph traversal logic, I want depth transitions between ConceptNodes to follow the defined progression order, so that learners are never presented with a deep concept before its overview or standard counterpart exists in the graph.

#### Acceptance Criteria

1. THE `ContentGraph` SHALL define depth as an ordered sequence: `"overview"` (0) < `"standard"` (1) < `"deep"` (2).
2. WHEN a ConceptNode of depth `"deep"` is added to the ContentGraph, THE `Builder` SHALL verify that at least one ConceptNode with depth `"standard"` sharing at least one common tag exists in the graph.
3. WHEN a ConceptNode of depth `"standard"` is added to the ContentGraph, THE `Builder` SHALL verify that at least one ConceptNode with depth `"overview"` sharing at least one common tag exists in the graph.
4. IF a ConceptNode of depth `"deep"` is added without a prerequisite `"standard"` node sharing a common tag, THEN THE `Builder` SHALL return an error indicating the depth progression violation.
5. IF a ConceptNode of depth `"standard"` is added without a prerequisite `"overview"` node sharing a common tag, THEN THE `Builder` SHALL return an error indicating the depth progression violation.
6. THE `Builder` SHALL allow a ConceptNode of depth `"overview"` to be added to the ContentGraph without any prerequisite depth check.

---

### Requirement 5: ContentGraph Container

**User Story:** As a developer building the ingest pipeline, I want a validated ContentGraph container that holds all nodes, edges, and source metadata for a learning session, so that the complete graph can be serialized, persisted, and rehydrated reliably.

#### Acceptance Criteria

1. THE `ContentGraph_Schema` SHALL validate that every ContentGraph has a non-empty `id` field of type UUID.
2. THE `ContentGraph_Schema` SHALL validate that the `nodes` field is a record mapping UUID strings to valid ConceptNodes.
3. THE `ContentGraph_Schema` SHALL validate that the `edges` field is a record mapping UUID strings to valid RelationshipEdges.
4. THE `ContentGraph_Schema` SHALL validate that every `fromNodeId` and `toNodeId` referenced in any RelationshipEdge corresponds to an existing key in the `nodes` record.
5. THE `ContentGraph_Schema` SHALL validate that the `sourceIds` field is an array of UUID strings listing all source documents contributing to the graph.
6. THE `ContentGraph_Schema` SHALL validate that every `sourceId` referenced in any EvidenceAnchor (across all nodes and edges) is present in the `sourceIds` array.
7. IF a ContentGraph is constructed with a RelationshipEdge referencing a `fromNodeId` not present in `nodes`, THEN THE `ContentGraph_Schema` SHALL return a validation error identifying the dangling reference.
8. IF a ContentGraph is constructed with an EvidenceAnchor referencing a `sourceId` not present in `sourceIds`, THEN THE `ContentGraph_Schema` SHALL return a validation error identifying the unregistered source.

---

### Requirement 6: Builder API

**User Story:** As a developer building the ingest pipeline, I want a fluent Builder API for constructing ContentGraph instances, so that graphs can be assembled safely from parsed source data with all invariants enforced at construction time rather than at render time.

#### Acceptance Criteria

1. THE `GraphBuilder` SHALL expose an `addSource(sourceId: string): GraphBuilder` method that registers a source UUID and returns the builder for chaining.
2. THE `GraphBuilder` SHALL expose an `addNode(node: ConceptNodeInput): Result<GraphBuilder, ValidationError>` method that validates the node against `ConceptNode_Schema` and the Provenance Gate before adding it.
3. THE `GraphBuilder` SHALL expose an `addEdge(edge: RelationshipEdgeInput): Result<GraphBuilder, ValidationError>` method that validates the edge against `RelationshipEdge_Schema` before adding it.
4. THE `GraphBuilder` SHALL expose a `build(): Result<ContentGraph, ValidationError[]>` method that runs full `ContentGraph_Schema` validation and returns either a valid ContentGraph or a list of all validation errors.
5. WHEN `addNode` is called with a ConceptNode that has an empty `evidenceAnchors` array, THE `GraphBuilder` SHALL return a `ValidationError` without mutating the builder state.
6. WHEN `addEdge` is called with a `"contradicts"` edge that lacks evidence from both source sides, THE `GraphBuilder` SHALL return a `ValidationError` without mutating the builder state.
7. WHEN `build` is called on a ContentGraph where any RelationshipEdge references a node not present in the graph, THE `GraphBuilder` SHALL return a `ValidationError` identifying each dangling reference.
8. THE `GraphBuilder` SHALL be immutable between method calls — each method that returns a `GraphBuilder` SHALL return a new instance rather than mutating the existing one.

---

### Requirement 7: Zod Schema Export and TypeScript Type Inference

**User Story:** As a developer consuming the data model in other packages, I want all Zod schemas exported alongside their inferred TypeScript types, so that I get runtime validation and compile-time type safety from a single source of truth.

#### Acceptance Criteria

1. THE `content-graph` package SHALL export `EvidenceAnchorSchema` and the inferred type `EvidenceAnchor` derived via `z.infer`.
2. THE `content-graph` package SHALL export `ConceptNodeSchema` and the inferred type `ConceptNode` derived via `z.infer`.
3. THE `content-graph` package SHALL export `RelationshipEdgeSchema` and the inferred type `RelationshipEdge` derived via `z.infer`.
4. THE `content-graph` package SHALL export `ContentGraphSchema` and the inferred type `ContentGraph` derived via `z.infer`.
5. THE `content-graph` package SHALL export `GraphBuilder` as a class with full TypeScript type signatures on all methods.
6. THE `content-graph` package SHALL compile without errors under TypeScript strict mode (`"strict": true`).
7. WHEN a consumer imports `ConceptNode` from the `content-graph` package, THE TypeScript compiler SHALL enforce that the `evidenceAnchors` field is typed as a non-empty tuple (`[EvidenceAnchor, ...EvidenceAnchor[]]`) at the type level.

---

### Requirement 8: Provenance Gate — Property-Based Tests

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests using fast-check that prove the Provenance Gate cannot be bypassed under any input, so that the guarantee is machine-verified rather than asserted by convention.

#### Acceptance Criteria

1. THE `ProvenanceGate_PBT` SHALL generate arbitrary ConceptNode inputs via fast-check arbitraries and verify that any input with an empty `evidenceAnchors` array is always rejected by `ConceptNode_Schema`.
2. THE `ProvenanceGate_PBT` SHALL generate arbitrary valid ConceptNode inputs (with at least one EvidenceAnchor) and verify that `ConceptNode_Schema` always accepts them.
3. THE `ProvenanceGate_PBT` SHALL generate arbitrary `"contradicts"` RelationshipEdge inputs with fewer than two distinct-source EvidenceAnchors and verify that `RelationshipEdge_Schema` always rejects them.
4. THE `ProvenanceGate_PBT` SHALL generate arbitrary valid `"contradicts"` RelationshipEdge inputs (with at least two EvidenceAnchors from distinct sources) and verify that `RelationshipEdge_Schema` always accepts them.
5. THE `ProvenanceGate_PBT` SHALL verify the round-trip property: FOR ALL valid ContentGraph instances, serializing to JSON and parsing back via `ContentGraph_Schema` SHALL produce a structurally equivalent ContentGraph.
6. THE `ProvenanceGate_PBT` SHALL verify the builder invariant: FOR ALL sequences of `addNode` and `addEdge` calls that include at least one node with an empty `evidenceAnchors` array, `build()` SHALL never return a successful ContentGraph.
7. WHEN the `ProvenanceGate_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

---

### Requirement 9: Prisma Schema for Persistence

**User Story:** As a developer building the persistence layer, I want Prisma models for ConceptNode, RelationshipEdge, and EvidenceAnchor that map to the validated TypeScript types, so that ContentGraph data can be stored in SQLite for local development and Postgres for production without schema divergence.

#### Acceptance Criteria

1. THE `Prisma_Schema` SHALL define a `ConceptNode` model with fields corresponding to all required fields of `ConceptNode_Schema`, using SQLite-compatible column types.
2. THE `Prisma_Schema` SHALL define a `RelationshipEdge` model with a foreign-key relation to `ConceptNode` for both `fromNodeId` and `toNodeId`.
3. THE `Prisma_Schema` SHALL define an `EvidenceAnchor` model with a foreign-key relation to `ConceptNode` and an optional foreign-key relation to `RelationshipEdge`.
4. THE `Prisma_Schema` SHALL store the `locator` field of `EvidenceAnchor` as a JSON column to accommodate the discriminated union variants.
5. THE `Prisma_Schema` SHALL store the `tags` field of `ConceptNode` as a JSON column.
6. THE `Prisma_Schema` SHALL enforce a database-level constraint that every `ConceptNode` row has at least one associated `EvidenceAnchor` row via a check or application-level guard documented in the schema comments.
7. WHEN the Prisma client is generated from the schema, THE TypeScript types produced SHALL be compatible with the Zod-inferred types without requiring manual type casting.
