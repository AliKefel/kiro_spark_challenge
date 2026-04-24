# Requirements Document

## Introduction

The Provenance Gate is the runtime enforcement layer for Agency Guardrail Rule 1 in Lattice. It is the single, mandatory checkpoint that every ConceptNode and RelationshipEdge must pass before being rendered, persisted, or surfaced to a learner. The gate is composed of three cooperating pieces: a pure validation function (`validateRenderable`), a React component (`<ProvenanceGate>`) that wraps all node and edge renderers, and a content-graph builder middleware that strips invalid nodes before persistence. All three pieces are proven correct by property-based tests using fast-check. No renderer in the codebase may display a ConceptNode without passing through this gate.

The gate builds directly on the `ConceptNode`, `RelationshipEdge`, and `EvidenceAnchor` types defined in the `content-graph-data-model` spec.

---

## Glossary

- **ProvenanceGate**: The single runtime checkpoint that validates a ConceptNode or RelationshipEdge has sufficient EvidenceAnchors before it is rendered or persisted.
- **validateRenderable**: A pure function that accepts a ConceptNode or RelationshipEdge and returns a `RenderableResult` — either `{ ok: true }` or `{ ok: false; reason: string }`. It never throws.
- **RenderableResult**: The discriminated union returned by `validateRenderable`: `{ ok: true }` or `{ ok: false; reason: string }`.
- **ProvenanceGate_Component**: The React component `<ProvenanceGate node={...}>{children}</ProvenanceGate>` that conditionally renders its children based on the result of `validateRenderable`.
- **DebugBadge**: A small, non-interactive UI element rendered in development mode when `validateRenderable` returns `{ ok: false }`, displaying the failure reason for developer inspection.
- **BuilderMiddleware**: A function that wraps the content-graph `GraphBuilder` and strips any ConceptNode or RelationshipEdge that fails `validateRenderable` before the graph is persisted, logging each removal.
- **ConceptNode**: A single discrete idea extracted from source material, always backed by at least one EvidenceAnchor. Defined in the `content-graph-data-model` spec.
- **RelationshipEdge**: A directed, typed connection between two ConceptNodes. Defined in the `content-graph-data-model` spec.
- **EvidenceAnchor**: A pointer to the exact location in a source document that backs a claim. Defined in the `content-graph-data-model` spec.
- **fast-check**: The property-based testing library used to prove gate invariants hold for all possible inputs.
- **Vitest**: The unit test runner used for all TypeScript tests.
- **dev mode**: The runtime environment where `process.env.NODE_ENV === "development"`.
- **production mode**: The runtime environment where `process.env.NODE_ENV === "production"`.

---

## Requirements

### Requirement 1: validateRenderable Function

**User Story:** As a developer building any renderer or persistence layer in Lattice, I want a single pure validation function that tells me whether a node or edge is safe to render, so that I have one authoritative checkpoint and cannot accidentally bypass the Provenance Gate.

#### Acceptance Criteria

1. THE `validateRenderable` function SHALL accept a value of type `ConceptNode | RelationshipEdge` as its sole argument.
2. THE `validateRenderable` function SHALL return a value of type `RenderableResult`, which is the discriminated union `{ ok: true } | { ok: false; reason: string }`.
3. THE `validateRenderable` function SHALL never throw, never return `undefined`, and never return `null` — for any input, including `null`, `undefined`, and structurally invalid objects.
4. WHEN `validateRenderable` receives a `ConceptNode` with an empty `evidenceAnchors` array, THE `validateRenderable` function SHALL return `{ ok: false, reason: "ConceptNode has no EvidenceAnchors" }`.
5. WHEN `validateRenderable` receives a `ConceptNode` with at least one valid `EvidenceAnchor`, THE `validateRenderable` function SHALL return `{ ok: true }`.
6. WHEN `validateRenderable` receives a `RelationshipEdge` of type `"contradicts"` with fewer than two EvidenceAnchors, THE `validateRenderable` function SHALL return `{ ok: false, reason: "contradicts-edge requires at least two EvidenceAnchors" }`.
7. WHEN `validateRenderable` receives a `RelationshipEdge` of type `"contradicts"` where all EvidenceAnchors share the same `sourceId`, THE `validateRenderable` function SHALL return `{ ok: false, reason: "contradicts-edge requires EvidenceAnchors from at least two distinct sources" }`.
8. WHEN `validateRenderable` receives a `RelationshipEdge` of any type other than `"contradicts"`, THE `validateRenderable` function SHALL return `{ ok: true }` regardless of the `evidenceAnchors` array contents.
9. IF `validateRenderable` receives a value that is not a valid `ConceptNode` or `RelationshipEdge` (e.g., `null`, `undefined`, a plain object missing required fields), THEN THE `validateRenderable` function SHALL return `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }`.
10. THE `validateRenderable` function SHALL be exported from the `provenance-gate` package as a named export with a fully typed signature under TypeScript strict mode.

---

### Requirement 2: ProvenanceGate React Component

**User Story:** As a developer building the Lattice graph canvas, I want a React component that wraps every ConceptNode and RelationshipEdge renderer and conditionally renders its children only when the Provenance Gate passes, so that no unanchored content can ever reach the learner's screen.

#### Acceptance Criteria

1. THE `ProvenanceGate_Component` SHALL accept a `node` prop of type `ConceptNode | RelationshipEdge` and a `children` prop of type `React.ReactNode`.
2. WHEN `validateRenderable(node)` returns `{ ok: true }`, THE `ProvenanceGate_Component` SHALL render its `children` unchanged.
3. WHEN `validateRenderable(node)` returns `{ ok: false }` and the runtime is dev mode, THE `ProvenanceGate_Component` SHALL render a `DebugBadge` displaying the `reason` string and SHALL NOT render `children`.
4. WHEN `validateRenderable(node)` returns `{ ok: false }` and the runtime is production mode, THE `ProvenanceGate_Component` SHALL render nothing (return `null`) and SHALL NOT render `children`.
5. THE `DebugBadge` SHALL be visually distinct — rendered with a yellow background and dark text — and SHALL include the text `"[ProvenanceGate blocked]"` followed by the `reason` string.
6. THE `DebugBadge` SHALL have `role="alert"` and `aria-live="polite"` so that assistive technologies announce the blocked state to developers using screen readers during development.
7. THE `ProvenanceGate_Component` SHALL use `React.forwardRef` so that parent components can attach refs to the rendered output.
8. THE `ProvenanceGate_Component` SHALL be a pure component — given the same `node` prop, it SHALL always produce the same render output.
9. THE `ProvenanceGate_Component` SHALL be exported from the `provenance-gate` package as a named export with full TypeScript prop types.
10. WHEN the `node` prop changes between renders, THE `ProvenanceGate_Component` SHALL re-evaluate `validateRenderable` with the new value and update the rendered output accordingly.

---

### Requirement 3: Builder Middleware for Persistence

**User Story:** As a developer building the content-graph ingest pipeline, I want a middleware layer that strips invalid nodes and edges from a ContentGraph before it is persisted, so that the database never contains unanchored content and every removal is logged for observability.

#### Acceptance Criteria

1. THE `BuilderMiddleware` SHALL expose a function `withProvenanceFilter(graph: ContentGraph): FilteredGraphResult` where `FilteredGraphResult` is `{ graph: ContentGraph; removed: RemovedEntry[] }`.
2. THE `RemovedEntry` type SHALL be `{ id: string; type: "ConceptNode" | "RelationshipEdge"; reason: string }`.
3. WHEN `withProvenanceFilter` processes a `ContentGraph`, THE `BuilderMiddleware` SHALL call `validateRenderable` on every `ConceptNode` in `graph.nodes` and remove any node where the result is `{ ok: false }`.
4. WHEN `withProvenanceFilter` processes a `ContentGraph`, THE `BuilderMiddleware` SHALL call `validateRenderable` on every `RelationshipEdge` in `graph.edges` and remove any edge where the result is `{ ok: false }`.
5. WHEN a `ConceptNode` is removed by `withProvenanceFilter`, THE `BuilderMiddleware` SHALL also remove all `RelationshipEdge` entries in `graph.edges` that reference the removed node's `id` in either `fromNodeId` or `toNodeId`.
6. WHEN `withProvenanceFilter` removes a node or edge, THE `BuilderMiddleware` SHALL append a `RemovedEntry` to the `removed` array in the returned `FilteredGraphResult`.
7. WHEN `withProvenanceFilter` removes a node or edge, THE `BuilderMiddleware` SHALL emit a structured log entry via `console.warn` containing the `id`, `type`, and `reason` of the removed entity.
8. THE `BuilderMiddleware` SHALL be a pure function — it SHALL NOT mutate the input `ContentGraph` and SHALL return a new `ContentGraph` instance in the result.
9. WHEN `withProvenanceFilter` is called on a `ContentGraph` where all nodes and edges pass `validateRenderable`, THE `BuilderMiddleware` SHALL return the original graph structure with an empty `removed` array.
10. THE `BuilderMiddleware` SHALL be exported from the `provenance-gate` package as a named export with full TypeScript type signatures under strict mode.

---

### Requirement 4: Single Checkpoint Enforcement

**User Story:** As a developer maintaining the Lattice codebase, I want a documented and enforced rule that no renderer may display a ConceptNode without passing through the ProvenanceGate component, so that the Agency Guardrail cannot be bypassed by adding new renderers that skip the check.

#### Acceptance Criteria

1. THE `provenance-gate` package SHALL export a TypeScript type `Renderable<T extends ConceptNode | RelationshipEdge>` that wraps a node or edge and can only be constructed by a function that has already called `validateRenderable` and received `{ ok: true }`.
2. THE `ProvenanceGate_Component` SHALL be the only component in the codebase that constructs a `Renderable` value — all other renderers SHALL accept `Renderable<ConceptNode>` as their prop type rather than raw `ConceptNode`.
3. THE `provenance-gate` package README SHALL document the enforcement contract: "No renderer may accept a raw `ConceptNode` prop. All node renderers must accept `Renderable<ConceptNode>` and receive it from `<ProvenanceGate>`."
4. THE `validateRenderable` function SHALL be the only code path that produces a `{ ok: true }` result — the `Renderable` constructor SHALL be unexported and inaccessible outside the `provenance-gate` package.

---

### Requirement 5: Property-Based Tests — validateRenderable Never Throws

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests that prove `validateRenderable` never throws and always returns a structured result, so that the gate itself cannot become a source of runtime crashes.

#### Acceptance Criteria

1. THE `ProvenanceGate_PBT` SHALL generate arbitrary JavaScript values (including `null`, `undefined`, numbers, strings, arrays, and deeply nested objects) via fast-check and verify that `validateRenderable` never throws for any input.
2. THE `ProvenanceGate_PBT` SHALL verify that for every arbitrary input, `validateRenderable` returns either `{ ok: true }` or an object with `ok === false` and a non-empty `reason` string — never any other shape.
3. WHEN the `ProvenanceGate_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

---

### Requirement 6: Property-Based Tests — No Empty-Anchor Node Renders

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests that prove no ConceptNode with an empty `evidenceAnchors` array ever passes the gate, so that the Provenance Gate invariant is machine-verified rather than asserted by convention.

#### Acceptance Criteria

1. THE `ProvenanceGate_PBT` SHALL generate arbitrary `ConceptNode`-shaped objects with an empty `evidenceAnchors` array via fast-check and verify that `validateRenderable` always returns `{ ok: false }` for every such input.
2. THE `ProvenanceGate_PBT` SHALL generate arbitrary valid `ConceptNode` objects (with at least one valid `EvidenceAnchor`) via fast-check and verify that `validateRenderable` always returns `{ ok: true }` for every such input.
3. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `ConceptNode` inputs where `evidenceAnchors.length === 0`, `validateRenderable` SHALL return `{ ok: false }`.
4. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `ConceptNode` inputs where `evidenceAnchors.length >= 1` and each anchor has a non-empty `id` and `sourceId`, `validateRenderable` SHALL return `{ ok: true }`.

---

### Requirement 7: Property-Based Tests — No Single-Sided Contradicts Edge Renders

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests that prove no `"contradicts"` RelationshipEdge with single-sided evidence ever passes the gate, so that contradiction claims are always backed by evidence from both sides.

#### Acceptance Criteria

1. THE `ProvenanceGate_PBT` SHALL generate arbitrary `RelationshipEdge` objects with `type === "contradicts"` and fewer than two EvidenceAnchors via fast-check and verify that `validateRenderable` always returns `{ ok: false }` for every such input.
2. THE `ProvenanceGate_PBT` SHALL generate arbitrary `RelationshipEdge` objects with `type === "contradicts"` where all EvidenceAnchors share the same `sourceId` via fast-check and verify that `validateRenderable` always returns `{ ok: false }` for every such input.
3. THE `ProvenanceGate_PBT` SHALL generate arbitrary valid `"contradicts"` RelationshipEdge objects (with at least two EvidenceAnchors from distinct `sourceId` values) via fast-check and verify that `validateRenderable` always returns `{ ok: true }` for every such input.
4. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `RelationshipEdge` inputs where `type === "contradicts"` and `evidenceAnchors` contains fewer than two entries, `validateRenderable` SHALL return `{ ok: false }`.
5. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `RelationshipEdge` inputs where `type !== "contradicts"`, `validateRenderable` SHALL return `{ ok: true }` regardless of `evidenceAnchors` contents.

---

### Requirement 8: Property-Based Tests — BuilderMiddleware Strips All Invalid Nodes

**User Story:** As a developer responsible for the persistence layer, I want property-based tests that prove the BuilderMiddleware never persists a ContentGraph containing nodes or edges that fail the Provenance Gate, so that the database invariant is machine-verified.

#### Acceptance Criteria

1. THE `ProvenanceGate_PBT` SHALL generate arbitrary `ContentGraph` instances containing a mix of valid and invalid `ConceptNode` entries via fast-check and verify that `withProvenanceFilter` always returns a graph where every node passes `validateRenderable`.
2. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs, every `ConceptNode` in the `graph` returned by `withProvenanceFilter` SHALL have `validateRenderable(node).ok === true`.
3. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs, every `RelationshipEdge` in the `graph` returned by `withProvenanceFilter` SHALL have `validateRenderable(edge).ok === true`.
4. THE `ProvenanceGate_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs, no `RelationshipEdge` in the filtered graph SHALL reference a `fromNodeId` or `toNodeId` that is not present in the filtered graph's `nodes` record.
5. THE `ProvenanceGate_PBT` SHALL verify the round-trip property: FOR ALL valid `ContentGraph` instances (all nodes and edges pass `validateRenderable`), `withProvenanceFilter` SHALL return a `removed` array of length zero and a graph structurally equivalent to the input.
