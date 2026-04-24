# Implementation Plan: Content Graph Data Model

## Overview

Build the `packages/content-graph/` package from scratch: Zod schemas for all four entity types, the immutable `GraphBuilder` API, the Prisma schema for persistence, and the full test suite (unit + property-based). Every task builds on the previous one and ends with all pieces wired together and exported from the public barrel.

---

## Tasks

- [x] 1. Scaffold the `packages/content-graph/` package
  - Create the directory structure: `src/schemas/`, `src/builder/`, `src/prisma/`, `tests/`
  - Add `package.json` with name `@lattice/content-graph`, declaring `zod`, `prisma`, `@prisma/client`, `vitest`, and `fast-check` as dependencies
  - Add `tsconfig.json` extending the workspace root config with `"strict": true`
  - Add a `vitest.config.ts` that points at the `tests/` directory
  - Register the package in the pnpm workspace `pnpm-workspace.yaml` and Turborepo `turbo.json`
  - _Requirements: 7.6_

- [ ] 2. Implement the `EvidenceAnchor` Zod schema and type
  - [x] 2.1 Create `src/schemas/evidence-anchor.schema.ts`
    - Implement `LocatorSchema` as a `z.discriminatedUnion("type", [...])` with three variants: `pdf` (page ≥ 1), `video` (timestampSeconds ≥ 0), `image` (region with all values ≥ 0)
    - Implement `EvidenceAnchorSchema` with `id` (UUID), `sourceId` (UUID), `locator`, and `excerpt` (1–300 chars)
    - Export `EvidenceAnchorSchema` and the inferred type `EvidenceAnchor` via `z.infer`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1_

  - [x] 2.2 Write unit tests for `EvidenceAnchorSchema`
    - Test each locator variant (pdf, video, image) with valid inputs
    - Test boundary values: excerpt length 1, 300, 301; page 1, 0; timestampSeconds 0, -1; all region values 0 and -0.001
    - Test that a non-UUID `id` or `sourceId` is rejected
    - _Requirements: 1.1–1.7_

- [ ] 3. Implement the `ConceptNode` Zod schema and type
  - [x] 3.1 Create `src/schemas/concept-node.schema.ts`
    - Implement `DepthSchema` as `z.enum(["overview", "standard", "deep"])`
    - Implement `ConceptNodeSchema` with all required fields: `id` (UUID), `title` (1–120 chars), `definition` (non-empty), `expandedExplanation` (optional, 1–800 chars), `depth`, `tags` (array of strings), `evidenceAnchors` (`z.array(EvidenceAnchorSchema).min(1)` — Provenance Gate)
    - Export `ConceptNodeSchema`, `DepthSchema`, and the inferred type `ConceptNode`
    - _Requirements: 2.1–2.7, 7.2_

  - [x] 3.2 Write unit tests for `ConceptNodeSchema`
    - Test valid node with one and multiple EvidenceAnchors
    - Test Provenance Gate: empty `evidenceAnchors` array is rejected with a clear error
    - Test title boundary values: 1, 120, 121 characters
    - Test `expandedExplanation` boundary values: 1, 800, 801 characters
    - Test all three `depth` enum values; test an invalid depth string
    - _Requirements: 2.1–2.10_

- [ ] 4. Implement the `RelationshipEdge` Zod schema and type
  - [x] 4.1 Create `src/schemas/relationship-edge.schema.ts`
    - Implement `EdgeTypeSchema` as `z.enum(["causes", "contains", "contradicts", "exemplifies", "depends-on", "elaborates"])`
    - Implement `RelationshipEdgeSchema` with `id` (UUID), `fromNodeId` (UUID), `toNodeId` (UUID), `type`, `confidence` (0–1 inclusive), `evidenceAnchors` (array, may be empty)
    - Add a `.superRefine()` that, when `type === "contradicts"`, checks that `evidenceAnchors.length >= 2` AND that at least two distinct `sourceId` values are present; emit a `custom` ZodIssue with code `CONTRADICTION_EVIDENCE_INSUFFICIENT` on failure
    - Export `RelationshipEdgeSchema`, `EdgeTypeSchema`, and the inferred type `RelationshipEdge`
    - _Requirements: 3.1–3.5, 3.6, 7.3_

  - [x] 4.2 Write unit tests for `RelationshipEdgeSchema`
    - Test all six edge types with valid inputs
    - Test confidence boundary values: 0, 0.5, 1, -0.001, 1.001
    - Test `"contradicts"` edge: accepted with two anchors from distinct sources
    - Test `"contradicts"` edge: rejected with one anchor, rejected with two anchors sharing the same `sourceId`
    - Test non-`"contradicts"` edges: accepted with empty `evidenceAnchors`
    - _Requirements: 3.1–3.9_

- [ ] 5. Implement the `ContentGraph` Zod schema and type
  - [x] 5.1 Create `src/schemas/content-graph.schema.ts`
    - Implement `ContentGraphSchema` with `id` (UUID), `nodes` (`z.record(z.string().uuid(), ConceptNodeSchema)`), `edges` (`z.record(z.string().uuid(), RelationshipEdgeSchema)`), `sourceIds` (array of UUIDs)
    - Add a `.superRefine()` that checks: (a) every edge's `fromNodeId` and `toNodeId` exist as keys in `nodes` — emit `DANGLING_REFERENCE` on failure; (b) every `sourceId` referenced in any EvidenceAnchor across all nodes and edges is present in `sourceIds` — emit `UNREGISTERED_SOURCE` on failure
    - Export `ContentGraphSchema` and the inferred type `ContentGraph`
    - _Requirements: 5.1–5.8, 7.4_

  - [x] 5.2 Write unit tests for `ContentGraphSchema`
    - Test a valid minimal graph (one node, no edges)
    - Test a valid graph with nodes and edges
    - Test dangling `fromNodeId` reference is rejected with `DANGLING_REFERENCE` error
    - Test dangling `toNodeId` reference is rejected with `DANGLING_REFERENCE` error
    - Test EvidenceAnchor with unregistered `sourceId` is rejected with `UNREGISTERED_SOURCE` error
    - _Requirements: 5.1–5.8_

- [x] 6. Implement the `ValidationError` type and Zod error mapper
  - Create `src/schemas/validation-error.ts`
  - Define the `ValidationError` interface: `{ code: string; message: string; path: string[]; constraint?: string }`
  - Implement `mapZodError(error: ZodError): ValidationError[]` that maps each `ZodIssue` to a `ValidationError`, using the error codes table from the design (`PROVENANCE_GATE_VIOLATION`, `CONTRADICTION_EVIDENCE_INSUFFICIENT`, `DANGLING_REFERENCE`, `UNREGISTERED_SOURCE`, `DEPTH_PROGRESSION_VIOLATION`, `FIELD_CONSTRAINT_VIOLATION`)
  - Export `ValidationError` and `mapZodError`
  - _Requirements: 6.4_

- [ ] 7. Implement the `GraphBuilder` class
  - [x] 7.1 Create `src/builder/graph-builder.ts`
    - Define the `Result<T, E>` discriminated union type: `{ ok: true; value: T } | { ok: false; error: E }`
    - Implement `GraphBuilder` as an immutable class: all internal state (`sourceIds`, `nodes`, `edges`) stored as readonly fields; every mutating method returns a **new** `GraphBuilder` instance
    - Implement `addSource(sourceId: string): GraphBuilder` — validates UUID format, returns new builder with source registered
    - Implement `addNode(node: ConceptNodeInput): Result<GraphBuilder, ValidationError>` — runs `ConceptNodeSchema.safeParse`, checks Provenance Gate, checks depth progression (Requirement 4), returns `{ ok: false }` without mutation on any failure
    - Implement `addEdge(edge: RelationshipEdgeInput): Result<GraphBuilder, ValidationError>` — runs `RelationshipEdgeSchema.safeParse`, returns `{ ok: false }` without mutation on failure
    - Implement `build(): Result<ContentGraph, ValidationError[]>` — assembles the graph object, runs `ContentGraphSchema.safeParse`, maps errors via `mapZodError`, returns `{ ok: false, error: errors }` on failure
    - Export `GraphBuilder`, `Result`, `ConceptNodeInput`, `RelationshipEdgeInput`
    - _Requirements: 6.1–6.8, 4.1–4.6_

  - [x] 7.2 Write unit tests for `GraphBuilder`
    - Test happy path: `addSource().addNode().addEdge().build()` returns a valid `ContentGraph`
    - Test `addNode` with empty `evidenceAnchors` returns `{ ok: false }` and does not mutate builder state (verify by calling `build()` on original instance)
    - Test `addEdge` with a `"contradicts"` edge lacking distinct-source anchors returns `{ ok: false }`
    - Test `build()` with a dangling edge reference returns `{ ok: false, error: [...] }` listing all violations
    - Test depth progression: adding `"standard"` node without a prior `"overview"` node sharing a tag returns `{ ok: false }`
    - Test depth progression: adding `"deep"` node without a prior `"standard"` node sharing a tag returns `{ ok: false }`
    - Test depth progression: adding `"overview"` node always succeeds (subject to field validity)
    - Test immutability: `addNode` returns a new object reference; original builder is unchanged
    - _Requirements: 6.1–6.8, 4.1–4.6_

- [x] 8. Checkpoint — Ensure all unit tests pass
  - Run `pnpm vitest --run` in `packages/content-graph/` and confirm all schema and builder unit tests pass
  - Ask the user if any questions arise before proceeding to property-based tests

- [x] 9. Write fast-check arbitraries
  - Create `tests/arbitraries.ts`
  - Implement `arbLocator`: generates all three locator variants with valid field ranges
  - Implement `arbEvidenceAnchor`: generates a valid `EvidenceAnchor` using `arbLocator`; accepts an optional `sourceIds` array to constrain `sourceId` values
  - Implement `arbConceptNode`: generates a valid `ConceptNode` with at least one anchor; accepts a `sourceIds` array
  - Implement `arbRelationshipEdge`: generates a valid non-`"contradicts"` edge; accepts `nodeIds` and `sourceIds` arrays
  - Implement `arbContradictsEdge`: generates a valid `"contradicts"` edge with at least two anchors from distinct sources
  - Implement `arbContentGraph`: generates a valid `ContentGraph` with at least one node and consistent `sourceIds`
  - Export all arbitraries
  - _Requirements: 8.1–8.7_

- [ ] 10. Write property-based tests — Provenance Gate and contradiction evidence
  - [x] 10.1 Create `tests/provenance-gate.pbt.test.ts`
    - **Property 1: Provenance Gate — empty anchors always rejected**
      - Generate arbitrary `ConceptNode` inputs with `evidenceAnchors: []`; assert `ConceptNodeSchema.safeParse()` always returns failure AND `GraphBuilder.addNode()` always returns `{ ok: false }`
      - Run 1000 iterations
      - Tag: `// Feature: content-graph-data-model, Property 1`
      - **Validates: Requirements 2.7, 2.8, 6.2, 6.5, 8.1, 8.6**

    - **Property 2: Provenance Gate — valid anchors always accepted**
      - Generate arbitrary valid `ConceptNode` inputs (≥ 1 anchor); assert `ConceptNodeSchema.safeParse()` always returns success
      - Run 1000 iterations
      - Tag: `// Feature: content-graph-data-model, Property 2`
      - **Validates: Requirements 2.1–2.7, 8.2**

    - **Property 3: Contradiction evidence — invalid "contradicts" edges always rejected**
      - Generate `"contradicts"` edges with either < 2 anchors or all anchors sharing the same `sourceId`; assert `RelationshipEdgeSchema.safeParse()` always returns failure
      - Run 1000 iterations
      - Tag: `// Feature: content-graph-data-model, Property 3`
      - **Validates: Requirements 3.6, 3.7, 3.8, 8.3**

    - **Property 4: Contradiction evidence — valid "contradicts" edges always accepted**
      - Generate `"contradicts"` edges with ≥ 2 anchors from distinct sources; assert `RelationshipEdgeSchema.safeParse()` always returns success
      - Run 100 iterations
      - Tag: `// Feature: content-graph-data-model, Property 4`
      - **Validates: Requirements 3.6, 8.4**

    - _Requirements: 8.1–8.4, 8.7_

  - [x] 10.2 Create `tests/provenance-gate.pbt.test.ts` — round-trip and builder invariant properties (append to same file)
    - **Property 5: ContentGraph round-trip serialization**
      - Generate arbitrary valid `ContentGraph` instances via `arbContentGraph`; serialize with `JSON.stringify`, parse with `ContentGraph_Schema.parse`; assert structural equivalence (all node IDs, edge IDs, anchor IDs, sourceIds preserved)
      - Run 100 iterations
      - Tag: `// Feature: content-graph-data-model, Property 5`
      - **Validates: Requirements 5.1–5.6, 7.1–7.4, 8.5**

    - **Property 6: Dangling edge references always rejected**
      - Generate `ContentGraph` inputs where at least one edge has a `fromNodeId` or `toNodeId` not present in `nodes`; assert `ContentGraphSchema.safeParse()` always returns failure
      - Run 100 iterations
      - Tag: `// Feature: content-graph-data-model, Property 6`
      - **Validates: Requirements 5.4, 5.7, 6.7**

    - **Property 8: Builder immutability**
      - Generate arbitrary sequences of `addSource`/`addNode`/`addEdge` calls; assert each call returns a new object reference and the original builder's internal state is unchanged
      - Run 100 iterations
      - Tag: `// Feature: content-graph-data-model, Property 8`
      - **Validates: Requirements 6.8**

    - _Requirements: 5.1–5.8, 6.7, 6.8, 8.5–8.7_

- [x] 11. Write property-based tests — Depth progression
  - Create `tests/depth-progression.pbt.test.ts`
  - **Property 7: Depth progression invariant**
    - Generate sequences where a `"standard"` node is added without a prior `"overview"` node sharing a tag; assert `GraphBuilder.addNode()` returns `{ ok: false }` with `DEPTH_PROGRESSION_VIOLATION`
    - Generate sequences where a `"deep"` node is added without a prior `"standard"` node sharing a tag; assert `GraphBuilder.addNode()` returns `{ ok: false }` with `DEPTH_PROGRESSION_VIOLATION`
    - Generate sequences where an `"overview"` node is added (all other fields valid); assert `GraphBuilder.addNode()` always returns `{ ok: true }`
    - Run 100 iterations per sub-property
    - Tag: `// Feature: content-graph-data-model, Property 7`
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**

- [x] 12. Checkpoint — Ensure all unit and property-based tests pass
  - Run `pnpm vitest --run` in `packages/content-graph/` and confirm all tests pass, including PBT suites
  - Ask the user if any questions arise before proceeding to the Prisma schema

- [x] 13. Implement the Prisma schema
  - Create `src/prisma/schema.prisma`
  - Define `datasource db` with `provider = "sqlite"` and `url = env("DATABASE_URL")`
  - Define `generator client` with `provider = "prisma-client-js"`
  - Define `ContentGraph` model: `id` (UUID, `@id @default(uuid())`), `sourceIds` (String — JSON array), `nodes` (relation), `edges` (relation), `createdAt` (DateTime)
  - Define `ConceptNode` model: `id`, `graphId` (FK to `ContentGraph`), `title`, `definition`, `expandedExplanation` (optional), `depth` (String), `tags` (String — JSON array), `evidenceAnchors` (relation), `fromEdges` / `toEdges` (named relations to `RelationshipEdge`); add schema comment documenting the application-level Provenance Gate guard
  - Define `RelationshipEdge` model: `id`, `graphId` (FK), `fromNodeId` / `toNodeId` (FKs to `ConceptNode` via named relations `"FromNode"` / `"ToNode"`), `type` (String), `confidence` (Float), `evidenceAnchors` (relation)
  - Define `EvidenceAnchor` model: `id`, `sourceId` (String), `locator` (String — JSON discriminated union), `excerpt` (String), optional `conceptNodeId` (FK), optional `relationshipEdgeId` (FK)
  - _Requirements: 9.1–9.7_

- [x] 14. Write Prisma smoke tests
  - Create `tests/prisma.smoke.test.ts`
  - Run `prisma validate` programmatically (or via a shell exec in the test) to confirm the schema is syntactically valid
  - Run `prisma generate` and assert the generated client types are importable without TypeScript errors (`tsc --noEmit`)
  - Verify that the generated `ConceptNode` Prisma type has fields matching the Zod-inferred `ConceptNode` type (spot-check `id`, `title`, `depth`, `tags`)
  - _Requirements: 9.7_

- [x] 15. Wire up the public barrel export
  - Create `src/index.ts`
  - Export all schemas and inferred types: `EvidenceAnchorSchema`, `EvidenceAnchor`, `ConceptNodeSchema`, `ConceptNode`, `DepthSchema`, `Depth`, `RelationshipEdgeSchema`, `RelationshipEdge`, `EdgeTypeSchema`, `EdgeType`, `ContentGraphSchema`, `ContentGraph`
  - Export `GraphBuilder`, `Result`, `ConceptNodeInput`, `RelationshipEdgeInput`
  - Export `ValidationError`, `mapZodError`
  - Run `tsc --noEmit` to confirm the package compiles under strict mode with zero errors
  - _Requirements: 7.1–7.7_

- [x] 16. Final checkpoint — Full test suite and type check
  - Run `pnpm vitest --run` in `packages/content-graph/` and confirm all tests pass (unit + PBT)
  - Run `tsc --noEmit` in `packages/content-graph/` and confirm zero TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but the PBT tasks (10.1, 10.2, 11) are strongly recommended — they are the machine-verified proof of the Provenance Gate required by the Agency Guardrail
- Each task references specific requirements for traceability
- The Provenance Gate (`evidenceAnchors` non-empty) is enforced at three layers: Zod schema (runtime), GraphBuilder (construction time), and Prisma comment (DB layer) — all three must remain consistent
- `locator`, `tags`, and `sourceIds` are stored as JSON strings in SQLite; migrate to native `Json` columns when switching to Postgres via Supabase (only the Prisma schema `provider` and column types change)
- The `"contradicts"` edge invariant (two distinct-source anchors) enforces Agency Guardrail Rule 2 — do not relax it
