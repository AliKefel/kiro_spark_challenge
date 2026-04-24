# Design Document: Provenance Gate

## Overview

The `provenance-gate` package is the runtime enforcement layer for Agency Guardrail Rule 1 in Lattice. It sits directly on top of `@lattice/content-graph` and provides three cooperating exports:

1. **`validateRenderable`** — a pure function that checks whether a `ConceptNode` or `RelationshipEdge` is safe to render or persist.
2. **`<ProvenanceGate>`** — a React component that wraps every node/edge renderer and conditionally renders children only when the gate passes.
3. **`withProvenanceFilter`** — a pure function that strips invalid nodes and edges from a `ContentGraph` before persistence, logging each removal.

A fourth export, **`Renderable<T>`**, is an opaque branded type that can only be constructed inside this package, making it impossible for downstream renderers to accept a raw `ConceptNode` without first passing through the gate.

The package is proven correct by property-based tests using **fast-check** and unit tests using **Vitest**.

---

## Architecture

### Package placement

```
packages/
  provenance-gate/
    src/
      validate-renderable.ts      # validateRenderable pure function + RenderableResult type
      renderable.ts               # Renderable<T> opaque branded type (unexported brand symbol)
      provenance-gate.tsx         # <ProvenanceGate> React component
      with-provenance-filter.ts   # withProvenanceFilter middleware function
      index.ts                    # Public barrel export
    tests/
      validate-renderable.unit.test.ts   # Unit tests for validateRenderable
      provenance-gate.unit.test.ts       # Unit tests for <ProvenanceGate>
      with-provenance-filter.unit.test.ts # Unit tests for withProvenanceFilter
      provenance-gate.pbt.test.ts        # fast-check property-based tests
      arbitraries.ts                     # Shared fast-check arbitraries (re-uses content-graph arbitraries)
    package.json
    tsconfig.json
    vitest.config.ts
    README.md
```

### Dependency flow

```
packages/provenance-gate/
  └── imports from @lattice/content-graph
        ConceptNode, RelationshipEdge, ContentGraph, EvidenceAnchor (types)
        ConceptNodeSchema, RelationshipEdgeSchema (Zod schemas for input validation)

apps/web/
  └── imports from @lattice/provenance-gate
        validateRenderable, ProvenanceGate, withProvenanceFilter, Renderable
```

### Key design decisions

**Decision: `validateRenderable` is the single source of truth.** Both `<ProvenanceGate>` and `withProvenanceFilter` call `validateRenderable` internally. There is no duplicated gate logic. This means a bug fix in `validateRenderable` automatically fixes both the render path and the persistence path.

**Decision: Opaque `Renderable<T>` type via brand symbol.** The brand symbol is declared in `renderable.ts` but never exported. TypeScript's structural typing means that external code cannot construct a `Renderable<T>` value without importing the brand — which is impossible. This makes the type-level enforcement machine-verifiable at compile time.

**Decision: `validateRenderable` never throws.** The function wraps all logic in a try/catch and returns `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }` for any unexpected input. This makes it safe to call from React render paths where an uncaught exception would crash the component tree.

**Decision: `withProvenanceFilter` is pure.** It never mutates the input `ContentGraph`. It returns a new object with new `nodes` and `edges` records. This makes it safe to use in immutable data pipelines and easy to test.

**Decision: `<ProvenanceGate>` uses `React.forwardRef`.** All interactive components in Lattice use `forwardRef` for focus management (accessibility standard). The gate component follows the same convention even though it is not itself interactive.

**Decision: `DebugBadge` is dev-only.** In production, a failed gate renders `null` silently. In development, it renders a visually distinct badge with `role="alert"` and `aria-live="polite"` so developers using screen readers during development are notified of blocked content.

---

## Components and Interfaces

### RenderableResult

```typescript
type RenderableResult =
  | { ok: true }
  | { ok: false; reason: string };
```

A discriminated union returned by `validateRenderable`. The `reason` string is human-readable and suitable for display in the `DebugBadge`.

### validateRenderable

```typescript
function validateRenderable(input: unknown): RenderableResult
```

**Signature**: Accepts `unknown` (not `ConceptNode | RelationshipEdge`) so that the function can safely handle garbage inputs without TypeScript narrowing preventing the call. The return type is always `RenderableResult`.

**Logic**:

```
1. Wrap entire body in try/catch — any thrown error returns { ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }
2. If input is null, undefined, or not an object → return { ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }
3. Attempt to discriminate between ConceptNode and RelationshipEdge:
   a. If input has a string "type" field that is one of the six EdgeType values → treat as RelationshipEdge
   b. Otherwise → treat as ConceptNode
4. ConceptNode path:
   a. If evidenceAnchors is missing or not an array → return { ok: false, reason: "ConceptNode has no EvidenceAnchors" }
   b. If evidenceAnchors.length === 0 → return { ok: false, reason: "ConceptNode has no EvidenceAnchors" }
   c. Otherwise → return { ok: true }
5. RelationshipEdge path:
   a. If type !== "contradicts" → return { ok: true }
   b. If evidenceAnchors is missing, not an array, or length < 2 → return { ok: false, reason: "contradicts-edge requires at least two EvidenceAnchors" }
   c. If all evidenceAnchors share the same sourceId → return { ok: false, reason: "contradicts-edge requires EvidenceAnchors from at least two distinct sources" }
   d. Otherwise → return { ok: true }
```

**Note on discrimination**: The function uses the `type` field to distinguish edges from nodes. All six `EdgeType` values (`"causes"`, `"contains"`, `"contradicts"`, `"exemplifies"`, `"depends-on"`, `"elaborates"`) are checked. Any object whose `type` field is not one of these six values is treated as a `ConceptNode` candidate.

### Renderable\<T\>

```typescript
// Internal brand symbol — never exported
declare const __renderable: unique symbol;

type Renderable<T extends ConceptNode | RelationshipEdge> = T & {
  readonly [__renderable]: true;
};

// Internal constructor — never exported
function makeRenderable<T extends ConceptNode | RelationshipEdge>(value: T): Renderable<T> {
  return value as Renderable<T>;
}
```

`Renderable<T>` is a branded intersection type. The brand symbol `__renderable` is a `unique symbol` declared with `declare const` — it exists only at the type level and has zero runtime cost. Because the symbol is not exported, no external module can reference it in a type position, making it impossible to construct a `Renderable<T>` outside this package.

`makeRenderable` is the only function that produces a `Renderable<T>`. It is called exclusively inside `<ProvenanceGate>` after `validateRenderable` returns `{ ok: true }`.

### ProvenanceGate Component

```typescript
interface ProvenanceGateProps {
  node: ConceptNode | RelationshipEdge;
  children: React.ReactNode;
}

const ProvenanceGate = React.forwardRef<HTMLDivElement, ProvenanceGateProps>(
  function ProvenanceGate({ node, children }, ref) {
    const result = validateRenderable(node);
    if (result.ok) {
      return <>{children}</>;
    }
    if (process.env.NODE_ENV === "development") {
      return <DebugBadge ref={ref} reason={result.reason} />;
    }
    return null;
  }
);
```

**DebugBadge** (internal, not exported):

```typescript
interface DebugBadgeProps {
  reason: string;
}

const DebugBadge = React.forwardRef<HTMLDivElement, DebugBadgeProps>(
  function DebugBadge({ reason }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        style={{
          backgroundColor: "#fef08a",  // yellow-200
          color: "#1c1917",            // stone-900
          padding: "4px 8px",
          fontSize: "12px",
          fontFamily: "monospace",
          borderRadius: "4px",
        }}
      >
        [ProvenanceGate blocked] {reason}
      </div>
    );
  }
);
```

**Accessibility**: `role="alert"` and `aria-live="polite"` ensure that screen readers announce the blocked state during development. The yellow background with dark text satisfies WCAG 2.2 Level AA contrast (4.5:1 minimum for text). The badge is non-interactive and never appears in production.

### withProvenanceFilter

```typescript
type RemovedEntry = {
  id: string;
  type: "ConceptNode" | "RelationshipEdge";
  reason: string;
};

type FilteredGraphResult = {
  graph: ContentGraph;
  removed: RemovedEntry[];
};

function withProvenanceFilter(graph: ContentGraph): FilteredGraphResult
```

**Logic**:

```
1. Initialize removed: RemovedEntry[] = []
2. Filter nodes:
   a. For each [id, node] in graph.nodes:
      - Call validateRenderable(node)
      - If ok: false → add to removed, mark nodeId as removed
      - If ok: true → keep in filteredNodes
3. Filter edges (two passes):
   a. For each [id, edge] in graph.edges:
      - If edge.fromNodeId or edge.toNodeId is in the removed node set → add to removed (reason: "references removed ConceptNode"), skip
      - Call validateRenderable(edge)
      - If ok: false → add to removed
      - If ok: true → keep in filteredEdges
4. For each removed entry, emit console.warn({ id, type, reason })
5. Return {
     graph: { ...graph, nodes: filteredNodes, edges: filteredEdges },
     removed
   }
```

**Immutability**: The function creates new `filteredNodes` and `filteredEdges` objects via `Object.fromEntries`. The input `graph` object is never mutated.

**Cascade removal**: When a node is removed, all edges referencing that node (in either `fromNodeId` or `toNodeId`) are also removed. This preserves the referential integrity invariant of `ContentGraph`.

### Public barrel export (index.ts)

```typescript
// Types
export type { RenderableResult } from "./validate-renderable.js";
export type { Renderable } from "./renderable.js";
export type { RemovedEntry, FilteredGraphResult } from "./with-provenance-filter.js";

// Functions
export { validateRenderable } from "./validate-renderable.js";
export { withProvenanceFilter } from "./with-provenance-filter.js";

// Component
export { ProvenanceGate } from "./provenance-gate.js";
```

`makeRenderable` is **not** exported. The `__renderable` brand symbol is **not** exported.

---

## Data Models

### Package configuration

**`package.json`**:

```json
{
  "name": "@lattice/provenance-gate",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest --run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@lattice/content-graph": "workspace:*",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "fast-check": "3.22.0",
    "jsdom": "^25.0.0",
    "vitest": "2.1.8"
  }
}
```

**`tsconfig.json`**:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**`vitest.config.ts`**:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
  },
});
```

### Type relationships

```
@lattice/content-graph exports:
  ConceptNode, RelationshipEdge, ContentGraph, EvidenceAnchor (types)
  ConceptNodeSchema, RelationshipEdgeSchema (Zod schemas)

@lattice/provenance-gate consumes:
  ConceptNode, RelationshipEdge, ContentGraph (types only — no Zod dependency at runtime)

@lattice/provenance-gate exports:
  validateRenderable(input: unknown): RenderableResult
  withProvenanceFilter(graph: ContentGraph): FilteredGraphResult
  ProvenanceGate (React component)
  Renderable<T> (opaque branded type)
  RenderableResult, RemovedEntry, FilteredGraphResult (types)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do.*

### Property 1: validateRenderable never throws

*For any* JavaScript value (including `null`, `undefined`, numbers, strings, arrays, and deeply nested objects), calling `validateRenderable(input)` SHALL never throw an exception and SHALL always return either `{ ok: true }` or `{ ok: false; reason: string }` — never `undefined`, never `null`, never any other shape.

**Validates: Requirements 1.3, 1.9, 5.1, 5.2**

### Property 2: Empty-anchor ConceptNode always blocked

*For any* object that has an `evidenceAnchors` field set to an empty array (regardless of all other field values), `validateRenderable(input)` SHALL return `{ ok: false }`.

**Validates: Requirements 1.4, 6.1, 6.3**

### Property 3: Valid ConceptNode always passes

*For any* valid `ConceptNode` (as defined by `ConceptNodeSchema`) with at least one `EvidenceAnchor`, `validateRenderable(input)` SHALL return `{ ok: true }`.

**Validates: Requirements 1.5, 6.2, 6.4**

### Property 4: Invalid contradicts edge always blocked — insufficient anchors

*For any* object with `type === "contradicts"` and an `evidenceAnchors` array of length 0 or 1, `validateRenderable(input)` SHALL return `{ ok: false }`.

**Validates: Requirements 1.6, 7.1, 7.4**

### Property 5: Invalid contradicts edge always blocked — same-source anchors

*For any* object with `type === "contradicts"` and an `evidenceAnchors` array where all entries share the same `sourceId`, `validateRenderable(input)` SHALL return `{ ok: false }`.

**Validates: Requirements 1.7, 7.2**

### Property 6: Valid contradicts edge always passes

*For any* valid `RelationshipEdge` with `type === "contradicts"` and at least two `EvidenceAnchor` entries with distinct `sourceId` values, `validateRenderable(input)` SHALL return `{ ok: true }`.

**Validates: Requirements 7.3**

### Property 7: Non-contradicts edge always passes

*For any* valid `RelationshipEdge` where `type !== "contradicts"`, `validateRenderable(input)` SHALL return `{ ok: true }` regardless of the `evidenceAnchors` array contents.

**Validates: Requirements 1.8, 7.5**

### Property 8: withProvenanceFilter output nodes all pass the gate

*For any* `ContentGraph` input (including graphs with a mix of valid and invalid nodes), every `ConceptNode` in the `graph` returned by `withProvenanceFilter` SHALL satisfy `validateRenderable(node).ok === true`.

**Validates: Requirements 3.3, 8.1, 8.2**

### Property 9: withProvenanceFilter output edges all pass the gate

*For any* `ContentGraph` input, every `RelationshipEdge` in the `graph` returned by `withProvenanceFilter` SHALL satisfy `validateRenderable(edge).ok === true`.

**Validates: Requirements 3.4, 8.3**

### Property 10: withProvenanceFilter output has no dangling edge references

*For any* `ContentGraph` input, no `RelationshipEdge` in the filtered graph SHALL reference a `fromNodeId` or `toNodeId` that is not present as a key in the filtered graph's `nodes` record.

**Validates: Requirements 3.5, 8.4**

### Property 11: withProvenanceFilter is pure — does not mutate input

*For any* `ContentGraph` input, calling `withProvenanceFilter(graph)` SHALL NOT modify the input `graph` object. The input's `nodes` and `edges` records SHALL be reference-equal to their pre-call state.

**Validates: Requirements 3.8**

### Property 12: withProvenanceFilter round-trip on valid graph

*For any* `ContentGraph` where every node and edge passes `validateRenderable`, `withProvenanceFilter(graph)` SHALL return `{ graph: <structurally equivalent>, removed: [] }` — the `removed` array SHALL have length zero.

**Validates: Requirements 3.9, 8.5**

---

## Error Handling

### validateRenderable error cases

| Input condition | Return value |
|---|---|
| `null` or `undefined` | `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }` |
| Non-object primitive | `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }` |
| Object missing `evidenceAnchors` (treated as ConceptNode) | `{ ok: false, reason: "ConceptNode has no EvidenceAnchors" }` |
| ConceptNode with `evidenceAnchors: []` | `{ ok: false, reason: "ConceptNode has no EvidenceAnchors" }` |
| `contradicts` edge with < 2 anchors | `{ ok: false, reason: "contradicts-edge requires at least two EvidenceAnchors" }` |
| `contradicts` edge with same-source anchors | `{ ok: false, reason: "contradicts-edge requires EvidenceAnchors from at least two distinct sources" }` |
| Any thrown exception (defensive) | `{ ok: false, reason: "invalid input: not a ConceptNode or RelationshipEdge" }` |

### withProvenanceFilter logging

Each removed entity is logged via `console.warn` with a structured object:

```typescript
console.warn("[provenance-gate] removed entity", {
  id: entry.id,
  type: entry.type,
  reason: entry.reason,
});
```

This format is consistent with structured logging conventions and can be parsed by log aggregation tools.

### ProvenanceGate component error boundary

`<ProvenanceGate>` does not implement a React error boundary. If `validateRenderable` throws (which it is designed never to do), the exception will propagate up to the nearest error boundary in the component tree. The never-throws guarantee is proven by Property 1.

---

## Testing Strategy

### Test file structure

| File | Type | Coverage |
|---|---|---|
| `tests/validate-renderable.unit.test.ts` | Unit | All `validateRenderable` input cases, reason strings, edge type discrimination |
| `tests/provenance-gate.unit.test.ts` | Unit | Component renders children on pass, DebugBadge in dev, null in prod, forwardRef, re-render on prop change |
| `tests/with-provenance-filter.unit.test.ts` | Unit | Filtering, cascade removal, console.warn spy, immutability, empty removed array |
| `tests/provenance-gate.pbt.test.ts` | PBT | Properties 1–12 |
| `tests/arbitraries.ts` | Shared | Re-exports and extends arbitraries from `@lattice/content-graph/tests/arbitraries` |

### fast-check arbitraries for this package

The `tests/arbitraries.ts` file imports the shared arbitraries from `@lattice/content-graph` and adds:

- `arbInvalidConceptNode` — ConceptNode-shaped object with `evidenceAnchors: []`
- `arbInvalidContradictsEdge` — `contradicts` edge with < 2 anchors or same-source anchors
- `arbMixedContentGraph` — ContentGraph with a mix of valid and invalid nodes/edges
- `arbArbitraryValue` — `fc.anything()` for the never-throws property

### PBT iteration counts

| Property | numRuns |
|---|---|
| Property 1 (never throws) | 1000 |
| Properties 2–3 (ConceptNode gate) | 1000 |
| Properties 4–7 (edge gate) | 500 |
| Properties 8–12 (withProvenanceFilter) | 200 |

### Unit test environment

Tests run in `jsdom` (via Vitest's `environment: "jsdom"`) to support React component rendering with `@testing-library/react`. The `process.env.NODE_ENV` is set to `"development"` or `"production"` per test case to exercise both branches of `<ProvenanceGate>`.
