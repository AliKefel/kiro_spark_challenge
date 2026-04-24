# Implementation Plan: Provenance Gate

## Overview

Build the `packages/provenance-gate/` package in TypeScript strict mode. The package exports `validateRenderable`, `<ProvenanceGate>`, `withProvenanceFilter`, and the opaque `Renderable<T>` type. Each step wires directly into the previous one, ending with a fully integrated, tested package.

## Tasks

- [ ] 1. Scaffold the package structure
  - Create `packages/provenance-gate/` directory with `src/` and `tests/` subdirectories
  - Write `package.json` with name `@lattice/provenance-gate`, `"type": "module"`, workspace dependency on `@lattice/content-graph`, React 18, `@testing-library/react`, `fast-check 3.22.0`, `vitest 2.1.8`, `jsdom`
  - Write `tsconfig.json` extending `../../tsconfig.json` with `strict: true`, `outDir: ./dist`, `rootDir: ./src`, `lib: ["ES2022", "DOM"]`, `jsx: react-jsx`
  - Write `vitest.config.ts` with `environment: "jsdom"`
  - Create empty `src/index.ts` barrel file
  - _Requirements: 1.10, 2.9, 3.10_

- [ ] 2. Implement `validateRenderable` and `RenderableResult`
  - [ ] 2.1 Create `src/validate-renderable.ts`
    - Define `RenderableResult` as `{ ok: true } | { ok: false; reason: string }`
    - Implement `validateRenderable(input: unknown): RenderableResult` with the full discrimination logic: null/undefined guard → edge-type discrimination via the six `EdgeType` values → ConceptNode path (empty `evidenceAnchors` check) → RelationshipEdge path (`contradicts` anchor count and distinct-source checks) → outer try/catch returning `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }`
    - Export `validateRenderable` and `RenderableResult` as named exports
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ]* 2.2 Write unit tests for `validateRenderable`
    - Test: `null` input → `{ ok: false }`
    - Test: `undefined` input → `{ ok: false }`
    - Test: number/string/array input → `{ ok: false }`
    - Test: ConceptNode with `evidenceAnchors: []` → `{ ok: false, reason: "ConceptNode has no EvidenceAnchors" }`
    - Test: ConceptNode with one valid anchor → `{ ok: true }`
    - Test: `contradicts` edge with zero anchors → `{ ok: false, reason: "contradicts-edge requires at least two EvidenceAnchors" }`
    - Test: `contradicts` edge with one anchor → `{ ok: false, reason: "contradicts-edge requires at least two EvidenceAnchors" }`
    - Test: `contradicts` edge with two anchors sharing same `sourceId` → `{ ok: false, reason: "contradicts-edge requires EvidenceAnchors from at least two distinct sources" }`
    - Test: `contradicts` edge with two anchors from distinct sources → `{ ok: true }`
    - Test: each of the five non-contradicts edge types with empty anchors → `{ ok: true }`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 3. Implement the `Renderable<T>` opaque type
  - [ ] 3.1 Create `src/renderable.ts`
    - Declare `const __renderable: unique symbol` (type-level only, no runtime value)
    - Define `type Renderable<T extends ConceptNode | RelationshipEdge> = T & { readonly [__renderable]: true }`
    - Implement `makeRenderable<T extends ConceptNode | RelationshipEdge>(value: T): Renderable<T>` as a cast — this is the only constructor
    - Export `Renderable` type only; do NOT export `__renderable` or `makeRenderable`
    - _Requirements: 4.1, 4.4_

- [ ] 4. Implement the `<ProvenanceGate>` React component
  - [ ] 4.1 Create `src/provenance-gate.tsx`
    - Define `ProvenanceGateProps` interface with `node: ConceptNode | RelationshipEdge` and `children: React.ReactNode`
    - Implement internal `DebugBadge` component using `React.forwardRef<HTMLDivElement, { reason: string }>` — renders a `<div>` with `role="alert"`, `aria-live="polite"`, yellow background (`#fef08a`), dark text (`#1c1917`), monospace font, and the text `[ProvenanceGate blocked] {reason}`
    - Implement `ProvenanceGate` using `React.forwardRef<HTMLDivElement, ProvenanceGateProps>` — calls `validateRenderable(node)`, renders children on `ok: true`, renders `DebugBadge` in `process.env.NODE_ENV === "development"` on `ok: false`, returns `null` in production on `ok: false`
    - Export `ProvenanceGate` as a named export; do NOT export `DebugBadge`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 4.2 Write unit tests for `<ProvenanceGate>`
    - Test: valid ConceptNode → children rendered
    - Test: invalid ConceptNode (empty anchors) in dev mode → DebugBadge rendered, children absent, badge contains `"[ProvenanceGate blocked]"` and the reason string
    - Test: invalid ConceptNode in production mode → renders `null`, children absent
    - Test: DebugBadge has `role="alert"` and `aria-live="polite"`
    - Test: `forwardRef` — ref attaches to the rendered div
    - Test: re-render with changed `node` prop from valid to invalid → output updates
    - Use `@testing-library/react` with `jsdom`; set `process.env.NODE_ENV` per test case
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10_

- [ ] 5. Implement `withProvenanceFilter`
  - [ ] 5.1 Create `src/with-provenance-filter.ts`
    - Define `RemovedEntry` as `{ id: string; type: "ConceptNode" | "RelationshipEdge"; reason: string }`
    - Define `FilteredGraphResult` as `{ graph: ContentGraph; removed: RemovedEntry[] }`
    - Implement `withProvenanceFilter(graph: ContentGraph): FilteredGraphResult`:
      - Pass 1: iterate `graph.nodes`, call `validateRenderable` on each, collect passing nodes into `filteredNodes` and failing node IDs into a `removedNodeIds` Set, push `RemovedEntry` for each failure
      - Pass 2: iterate `graph.edges`, skip any edge whose `fromNodeId` or `toNodeId` is in `removedNodeIds` (push cascade `RemovedEntry` with reason `"references removed ConceptNode"`), call `validateRenderable` on remaining edges, collect passing edges into `filteredEdges`, push `RemovedEntry` for each failure
      - Emit `console.warn("[provenance-gate] removed entity", { id, type, reason })` for each entry in `removed`
      - Return `{ graph: { ...graph, nodes: filteredNodes, edges: filteredEdges }, removed }`
    - Export `withProvenanceFilter`, `RemovedEntry`, and `FilteredGraphResult` as named exports
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 5.2 Write unit tests for `withProvenanceFilter`
    - Test: graph with all valid nodes/edges → `removed: []`, returned graph structurally equivalent to input
    - Test: graph with one invalid node (empty anchors) → node absent from output, `removed` contains one entry with correct `id`, `type: "ConceptNode"`, and `reason`
    - Test: graph with one invalid node that has two edges → node and both edges absent from output, `removed` has three entries (node + 2 cascade edges)
    - Test: graph with one invalid `contradicts` edge → edge absent from output, `removed` has one entry with `type: "RelationshipEdge"`
    - Test: `console.warn` called once per removed entry (use `vi.spyOn`)
    - Test: input graph object is not mutated — `graph.nodes` and `graph.edges` reference-equal before and after call
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 6. Wire up the public barrel export
  - Update `src/index.ts` to re-export `RenderableResult` and `validateRenderable` from `./validate-renderable.js`, `Renderable` type from `./renderable.js`, `ProvenanceGate` from `./provenance-gate.js`, and `RemovedEntry`, `FilteredGraphResult`, `withProvenanceFilter` from `./with-provenance-filter.js`
  - Verify `makeRenderable` and `__renderable` are NOT exported
  - Run `tsc --noEmit` to confirm the package compiles under strict mode with no errors
  - _Requirements: 1.10, 2.9, 3.10, 4.1, 4.4_

- [ ] 7. Checkpoint — unit tests pass
  - Ensure all unit tests pass: `vitest --run`
  - Ensure TypeScript compilation passes: `tsc --noEmit`
  - Ask the user if any questions arise before proceeding to property-based tests.

- [ ] 8. Write shared fast-check arbitraries
  - [ ] 8.1 Create `tests/arbitraries.ts`
    - Re-export `arbConceptNode`, `arbRelationshipEdge`, `arbContradictsEdge`, `arbContentGraph`, `arbEvidenceAnchor` from `@lattice/content-graph/tests/arbitraries` (or copy and adapt if the path is not importable from outside the package)
    - Add `arbInvalidConceptNode`: generates a ConceptNode-shaped object with `evidenceAnchors: []` by mapping `arbConceptNode` and overriding the field
    - Add `arbInvalidContradictsEdge`: `fc.oneof` of (a) `contradicts` edge with zero anchors, (b) one anchor, (c) two anchors sharing the same `sourceId`
    - Add `arbValidContradictsEdge`: `contradicts` edge with two anchors from distinct `sourceId` values (adapt `arbContradictsEdge`)
    - Add `arbMixedContentGraph`: ContentGraph with at least one invalid node (empty anchors) mixed with valid nodes and edges
    - Add `arbArbitraryValue`: `fc.anything()` for the never-throws property
    - _Requirements: 5.1, 6.1, 7.1, 8.1_

- [ ] 9. Write property-based tests
  - [ ] 9.1 Create `tests/provenance-gate.pbt.test.ts`
    - **Property 1: validateRenderable never throws**
      - Use `arbArbitraryValue` (`fc.anything()`), assert `validateRenderable` does not throw and returns `{ ok: true }` or `{ ok: false; reason: string }` for every input
      - `numRuns: 1000`
      - _Requirements: 1.3, 1.9, 5.1, 5.2_

  - [ ]* 9.2 Write property test for Property 2 — empty-anchor ConceptNode always blocked
    - Use `arbInvalidConceptNode`, assert `validateRenderable` returns `{ ok: false }` for every input
    - `numRuns: 1000`
    - **Property 2: Empty-anchor ConceptNode always blocked**
    - **Validates: Requirements 1.4, 6.1, 6.3**

  - [ ]* 9.3 Write property test for Property 3 — valid ConceptNode always passes
    - Use `arbConceptNode`, assert `validateRenderable` returns `{ ok: true }` for every input
    - `numRuns: 1000`
    - **Property 3: Valid ConceptNode always passes**
    - **Validates: Requirements 1.5, 6.2, 6.4**

  - [ ]* 9.4 Write property test for Property 4 — invalid contradicts edge (insufficient anchors) always blocked
    - Use `arbInvalidContradictsEdge` filtered to cases with < 2 anchors, assert `validateRenderable` returns `{ ok: false }` for every input
    - `numRuns: 500`
    - **Property 4: Invalid contradicts edge always blocked — insufficient anchors**
    - **Validates: Requirements 1.6, 7.1, 7.4**

  - [ ]* 9.5 Write property test for Property 5 — invalid contradicts edge (same-source anchors) always blocked
    - Use `arbInvalidContradictsEdge` filtered to same-source cases, assert `validateRenderable` returns `{ ok: false }` for every input
    - `numRuns: 500`
    - **Property 5: Invalid contradicts edge always blocked — same-source anchors**
    - **Validates: Requirements 1.7, 7.2**

  - [ ]* 9.6 Write property test for Property 6 — valid contradicts edge always passes
    - Use `arbValidContradictsEdge`, assert `validateRenderable` returns `{ ok: true }` for every input
    - `numRuns: 500`
    - **Property 6: Valid contradicts edge always passes**
    - **Validates: Requirements 7.3**

  - [ ]* 9.7 Write property test for Property 7 — non-contradicts edge always passes
    - Use `arbRelationshipEdge` (which excludes `contradicts`), assert `validateRenderable` returns `{ ok: true }` for every input
    - `numRuns: 500`
    - **Property 7: Non-contradicts edge always passes**
    - **Validates: Requirements 1.8, 7.5**

  - [ ]* 9.8 Write property test for Property 8 — withProvenanceFilter output nodes all pass the gate
    - Use `arbMixedContentGraph`, call `withProvenanceFilter`, assert every node in the output satisfies `validateRenderable(node).ok === true`
    - `numRuns: 200`
    - **Property 8: withProvenanceFilter output nodes all pass the gate**
    - **Validates: Requirements 3.3, 8.1, 8.2**

  - [ ]* 9.9 Write property test for Property 9 — withProvenanceFilter output edges all pass the gate
    - Use `arbMixedContentGraph`, call `withProvenanceFilter`, assert every edge in the output satisfies `validateRenderable(edge).ok === true`
    - `numRuns: 200`
    - **Property 9: withProvenanceFilter output edges all pass the gate**
    - **Validates: Requirements 3.4, 8.3**

  - [ ]* 9.10 Write property test for Property 10 — no dangling edge references after filtering
    - Use `arbMixedContentGraph`, call `withProvenanceFilter`, assert no output edge references a `fromNodeId` or `toNodeId` absent from the output `nodes` record
    - `numRuns: 200`
    - **Property 10: withProvenanceFilter output has no dangling edge references**
    - **Validates: Requirements 3.5, 8.4**

  - [ ]* 9.11 Write property test for Property 11 — withProvenanceFilter does not mutate input
    - Use `arbContentGraph`, snapshot `graph.nodes` and `graph.edges` references before calling `withProvenanceFilter`, assert they are reference-equal after the call
    - `numRuns: 200`
    - **Property 11: withProvenanceFilter is pure — does not mutate input**
    - **Validates: Requirements 3.8**

  - [ ]* 9.12 Write property test for Property 12 — round-trip on valid graph
    - Use `arbContentGraph` (all nodes/edges are valid by construction), call `withProvenanceFilter`, assert `removed.length === 0` and all node/edge IDs are preserved in the output
    - `numRuns: 200`
    - **Property 12: withProvenanceFilter round-trip on valid graph**
    - **Validates: Requirements 3.9, 8.5**

- [ ] 10. Write the package README
  - Create `packages/provenance-gate/README.md`
  - Document the enforcement contract: "No renderer may accept a raw `ConceptNode` prop. All node renderers must accept `Renderable<ConceptNode>` and receive it from `<ProvenanceGate>`."
  - Document the three exports (`validateRenderable`, `<ProvenanceGate>`, `withProvenanceFilter`) with usage examples
  - Document the `Renderable<T>` opaque type and why the constructor is unexported
  - _Requirements: 4.3_

- [ ] 11. Final checkpoint — all tests pass
  - Run `vitest --run` and confirm all unit tests and property-based tests pass
  - Run `tsc --noEmit` and confirm zero TypeScript errors
  - Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests (9.2–9.12) are optional sub-tasks; task 9.1 (never-throws) is required as it is the core safety guarantee
- Each task references specific requirements for traceability
- `makeRenderable` and `__renderable` must never appear in `src/index.ts` — the opaque type enforcement depends on this
- The `DebugBadge` component must never be exported — it is an internal implementation detail of `<ProvenanceGate>`
- `withProvenanceFilter` must perform cascade removal in a single pass over edges after the node pass completes, to avoid missing edges that reference nodes removed in the same call
