# Requirements Document

## Introduction

The interactive canvas is the primary rendering surface of Lattice. It receives a validated `ContentGraph` from the ingestion pipeline and renders it as an interactive infographic using React Flow. Every `ConceptNode` is displayed as a visually distinct node whose type (concept, definition, example, claim, or contradiction) is communicated through both color and iconography. Learners can pan, zoom, and navigate the graph entirely by keyboard. Tapping or clicking a node opens a detail panel showing the full definition, expanded explanation, source chips, and related nodes. Source chips expand to reveal the specific `EvidenceAnchor` and offer a "jump to source" action. When any `"contradicts"` edge exists in the graph, a persistent banner surfaces at the top of the canvas.

The Provenance Gate is a hard requirement: every node rendered on the canvas must pass through the `<ProvenanceGate>` component defined in the `provenance-gate` spec. No renderer may accept a raw `ConceptNode` prop — all node renderers accept `Renderable<ConceptNode>` and receive it exclusively from `<ProvenanceGate>`.

The canvas is built for college students with ADHD and/or dyslexia. All interactions respect `prefers-reduced-motion`, support 200% browser zoom without layout breakage, and are fully operable by keyboard and screen reader.

---

## Glossary

- **Canvas**: The React Flow–based interactive surface that renders the `ContentGraph` as a pannable, zoomable infographic.
- **CanvasNode**: A React Flow custom node component that renders a single `ConceptNode` from the graph. Always wrapped by `<ProvenanceGate>`.
- **NodeType**: The visual category of a `CanvasNode`, derived from the `ConceptNode`'s `tags` and `depth` fields. One of: `"concept"`, `"definition"`, `"example"`, `"claim"`, `"contradiction"`.
- **DetailPanel**: The slide-in panel that opens when a learner activates a node, showing the full title, definition, expanded explanation, source chips, and related nodes.
- **SourceChip**: A compact UI element on a node or in the `DetailPanel` that represents one `EvidenceAnchor`. Expands on activation to show the excerpt and a "jump to source" action.
- **EvidenceAnchor**: A pointer to the exact location in a source document backing a claim, as defined in the `content-graph-data-model` spec.
- **ContradictionsBanner**: A persistent, dismissible banner rendered at the top of the canvas when the `ContentGraph` contains at least one `"contradicts"` edge.
- **ProvenanceGate**: The `<ProvenanceGate>` React component from the `provenance-gate` spec. The only component that may construct a `Renderable<ConceptNode>` value.
- **Renderable**: The opaque wrapper type from the `provenance-gate` package. Node renderers accept `Renderable<ConceptNode>`, never raw `ConceptNode`.
- **ForceLayout**: The automatic node positioning algorithm applied when the graph is first rendered. Uses React Flow's built-in layout or ELK.js for hierarchy-aware positioning.
- **FocusMode**: An ADHD-mode canvas state where non-active nodes are dimmed to 20% opacity, reducing visual noise.
- **KeyboardNavigator**: The subsystem that maps keyboard events to canvas actions: arrow keys move focus between nodes, `+`/`-` zoom, `0` resets the viewport, `Enter` opens the `DetailPanel`.
- **MiniMap**: The React Flow `<MiniMap>` component rendered in the corner of the canvas for spatial orientation.
- **ContentGraph**: The top-level container holding all `ConceptNode` and `RelationshipEdge` entries for a learning session, as defined in the `content-graph-data-model` spec.
- **ConceptNode**: A single discrete idea extracted from source material, always backed by at least one `EvidenceAnchor`, as defined in the `content-graph-data-model` spec.
- **RelationshipEdge**: A directed, typed connection between two `ConceptNode` entries, as defined in the `content-graph-data-model` spec.
- **React Flow**: The third-party library used for the interactive canvas. Custom SVG is explicitly prohibited.
- **Framer Motion**: The animation library used for panel transitions and layout animations. All animations must respect `prefers-reduced-motion`.
- **prefers-reduced-motion**: The CSS media feature and corresponding React hook used to disable or replace animations for learners who have requested reduced motion.
- **WCAG 2.2 AA**: The accessibility conformance level required for all canvas UI components.
- **aria-live**: An ARIA attribute used on dynamic regions so screen readers announce updates without interrupting the learner's current focus.

---

## Requirements

### Requirement 1: Provenance Gate Enforcement on the Canvas

**User Story:** As a developer building the canvas, I want every node renderer to receive a `Renderable<ConceptNode>` rather than a raw `ConceptNode`, so that the Provenance Gate cannot be bypassed by any canvas component.

#### Acceptance Criteria

1. THE `Canvas` SHALL wrap every `CanvasNode` render call in the `<ProvenanceGate>` component from the `provenance-gate` package before passing any data to a node renderer.
2. THE `CanvasNode` component SHALL accept a `node` prop typed as `Renderable<ConceptNode>` and SHALL NOT accept a prop typed as raw `ConceptNode`.
3. WHEN `<ProvenanceGate>` receives a `ConceptNode` that fails `validateRenderable`, THE `Canvas` SHALL render nothing in place of that node in production mode and SHALL render a `DebugBadge` in development mode, consistent with the `provenance-gate` spec.
4. THE `Canvas` SHALL NOT render any `ConceptNode` that has not passed through `<ProvenanceGate>`, regardless of how the node data arrives (initial load, live update, or re-render).
5. IF a `ContentGraph` is passed to the `Canvas` containing a `ConceptNode` with an empty `evidenceAnchors` array, THEN THE `Canvas` SHALL silently omit that node from the rendered graph in production mode without throwing a runtime error.
6. THE `Canvas` component SHALL be exported with a TypeScript prop type that accepts `ContentGraph` (not individual nodes), so that the gate is applied uniformly at the graph level rather than per-call-site.

---

### Requirement 2: Force-Directed Layout

**User Story:** As a learner, I want the graph nodes to be automatically positioned so that related concepts are visually grouped and the layout is readable without manual arrangement.

#### Acceptance Criteria

1. WHEN the `Canvas` receives a `ContentGraph`, THE `ForceLayout` SHALL compute initial node positions using React Flow's built-in layout algorithm or ELK.js (selected based on whether the graph contains hierarchical `"contains"` edges).
2. WHEN the `ContentGraph` contains `"contains"` edges, THE `ForceLayout` SHALL use ELK.js in hierarchical mode to position parent nodes above their children.
3. WHEN the `ContentGraph` contains no `"contains"` edges, THE `ForceLayout` SHALL use a force-directed algorithm that minimises edge crossings and distributes nodes with a minimum spacing of 80px between node boundaries.
4. THE `ForceLayout` SHALL complete initial positioning and render the first frame within 500ms of receiving a `ContentGraph` of up to 100 nodes.
5. WHEN `prefers-reduced-motion` is set to `reduce`, THE `ForceLayout` SHALL apply final node positions immediately without animating the transition from initial to computed positions.
6. WHEN `prefers-reduced-motion` is not set to `reduce`, THE `ForceLayout` SHALL animate node positions to their computed locations using Framer Motion with a duration of no more than 400ms.
7. THE `ForceLayout` SHALL re-run and update node positions when the `ContentGraph` prop changes (e.g., a new node is added after initial render), preserving the positions of unchanged nodes.

---

### Requirement 3: Distinct Visual Treatment per Node Type

**User Story:** As a learner with ADHD or dyslexia, I want each node type to have a visually distinct appearance using both color and iconography, so that I can identify the type of information at a glance without relying on color alone.

#### Acceptance Criteria

1. THE `Canvas` SHALL render `CanvasNode` components with distinct visual styling for each `NodeType`: `"concept"` (blue border, circle icon), `"definition"` (purple border, book icon), `"example"` (green border, lightbulb icon), `"claim"` (amber border, quote icon), and `"contradiction"` (red border, warning icon).
2. THE `CanvasNode` SHALL communicate node type using both a color-coded border and a labeled icon, so that color is never the only signal (WCAG 2.2 AA, accessibility standard rule 10).
3. THE `CanvasNode` SHALL meet WCAG 2.2 Level AA contrast requirements: 4.5:1 for all text content within the node and 3:1 for the node border against the canvas background.
4. THE `CanvasNode` SHALL display the `ConceptNode.title` as the primary label, truncated to two lines with an ellipsis if it exceeds the node width.
5. THE `CanvasNode` SHALL display a `SourceChip` count badge showing the number of `EvidenceAnchor` entries on the node, so that learners can see provenance density at a glance.
6. WHEN the `Canvas` is in `FocusMode`, THE `CanvasNode` SHALL render non-active nodes at 20% opacity and the active node at full opacity, using a CSS transition that respects `prefers-reduced-motion`.
7. THE `CanvasNode` SHALL have a minimum rendered size of 120×60px to ensure the click/tap target meets the 44×44px minimum (accessibility standard rule 11).
8. THE `CanvasNode` SHALL use the Lexend font when the learner's profile has dyslexia mode enabled, and the system default font otherwise.

---

### Requirement 4: Pan, Zoom, and Viewport Controls

**User Story:** As a learner, I want to pan and zoom the canvas freely so that I can explore large graphs without losing context.

#### Acceptance Criteria

1. THE `Canvas` SHALL support mouse/trackpad pan by dragging the canvas background and pinch-to-zoom on touch devices via React Flow's built-in interaction handlers.
2. THE `Canvas` SHALL render a React Flow `<MiniMap>` component in the bottom-right corner of the canvas, showing a scaled overview of all nodes and the current viewport position.
3. THE `MiniMap` SHALL use the same color coding as the `CanvasNode` components so that node types are identifiable in the minimap.
4. THE `Canvas` SHALL support zoom levels from 25% to 400% of the default viewport scale.
5. WHEN the learner zooms to 200% browser zoom, THE `Canvas` layout SHALL remain fully usable without horizontal scrolling (accessibility standard rule 7).
6. THE `Canvas` SHALL render zoom control buttons (`+`, `−`, and reset) as `<button>` elements with visible labels and `aria-label` attributes, meeting the 44×44px minimum tap target size.
7. WHEN the reset button is activated, THE `Canvas` SHALL fit all nodes within the viewport using React Flow's `fitView` function.

---

### Requirement 5: Keyboard Navigation

**User Story:** As a learner who cannot use a mouse, I want to navigate the entire canvas by keyboard so that I can explore the graph, zoom, and open node details without a pointing device.

#### Acceptance Criteria

1. THE `KeyboardNavigator` SHALL move focus to the next node in the graph when the learner presses the right or down arrow key, and to the previous node when the learner presses the left or up arrow key, cycling through nodes in the order they appear in the `ContentGraph.nodes` record.
2. WHEN a `CanvasNode` receives keyboard focus, THE `Canvas` SHALL pan the viewport to center the focused node if it is not fully visible.
3. WHEN the learner presses `+` or `=`, THE `KeyboardNavigator` SHALL zoom the canvas in by one step (25% increment).
4. WHEN the learner presses `-`, THE `KeyboardNavigator` SHALL zoom the canvas out by one step (25% decrement).
5. WHEN the learner presses `0`, THE `KeyboardNavigator` SHALL reset the viewport to fit all nodes (equivalent to activating the reset button).
6. WHEN the learner presses `Enter` or `Space` while a `CanvasNode` has focus, THE `KeyboardNavigator` SHALL open the `DetailPanel` for that node.
7. WHEN the `DetailPanel` is open, THE `KeyboardNavigator` SHALL trap focus within the panel and SHALL close the panel when the learner presses `Escape`, returning focus to the previously focused `CanvasNode`.
8. THE `CanvasNode` SHALL have a visible focus indicator meeting WCAG 2.2 AA: `focus-visible:ring-2 ring-offset-2` (accessibility standard rule 3).
9. THE `Canvas` SHALL expose a `tabIndex` on each `CanvasNode` so that the learner can reach the first node by pressing `Tab` from outside the canvas.
10. THE `KeyboardNavigator` SHALL announce the currently focused node's title and type to screen readers via an `aria-live="polite"` region when focus moves between nodes.

---

### Requirement 6: Node Detail Panel

**User Story:** As a learner, I want to tap or click a node to open a detail panel showing the full definition, expanded explanation, source chips, and related nodes, so that I can explore a concept in depth without leaving the canvas.

#### Acceptance Criteria

1. WHEN a learner activates a `CanvasNode` (click, tap, or `Enter`/`Space` key), THE `DetailPanel` SHALL open as a slide-in panel anchored to the right side of the canvas, displaying the node's `title`, `definition`, `expandedExplanation` (if present), `SourceChip` list, and related node list.
2. THE `DetailPanel` SHALL animate open using Framer Motion; WHEN `prefers-reduced-motion` is set to `reduce`, THE `DetailPanel` SHALL appear immediately without a slide animation.
3. THE `DetailPanel` SHALL display the `ConceptNode.depth` value as a human-readable label (`"Overview"`, `"Standard"`, or `"Deep"`).
4. THE `DetailPanel` SHALL list all `RelationshipEdge` entries connected to the active node, grouped by edge type, with each related node's title rendered as a focusable link that moves canvas focus to that node when activated.
5. THE `DetailPanel` SHALL render one `SourceChip` per `EvidenceAnchor` in the active node's `evidenceAnchors` array.
6. THE `DetailPanel` SHALL be implemented as a `<dialog>` element or a `role="dialog"` region with `aria-labelledby` pointing to the panel title, so that screen readers announce the panel correctly when it opens.
7. WHEN the `DetailPanel` opens, THE `Canvas` SHALL move focus to the first interactive element inside the panel (the close button or the first `SourceChip`).
8. THE `DetailPanel` SHALL display the node type icon and label (matching the `CanvasNode` visual treatment) so that the learner can confirm which node type they are viewing.
9. WHEN `prefers-reduced-motion` is not set to `reduce`, THE `DetailPanel` SHALL use a Framer Motion slide-in animation with a duration of no more than 300ms.
10. THE `DetailPanel` SHALL support 200% browser zoom without any content being clipped or requiring horizontal scrolling.

---

### Requirement 7: Source Chips and EvidenceAnchor Expansion

**User Story:** As a learner, I want to tap a source chip to see the exact excerpt from the source material and jump directly to that location, so that I can verify any claim in the infographic against its original source.

#### Acceptance Criteria

1. THE `SourceChip` SHALL display the source type icon (PDF page icon, video timestamp icon, or image region icon) and a short label derived from the `EvidenceAnchor.locator` (e.g., "p. 12", "0:42", "Region").
2. WHEN a learner activates a `SourceChip` (click, tap, or `Enter`/`Space` key), THE `SourceChip` SHALL expand inline to show the `EvidenceAnchor.excerpt` text and a "Jump to source" button.
3. WHEN the "Jump to source" button is activated, THE `Canvas` SHALL emit a `onJumpToSource` callback prop with the `EvidenceAnchor` object, allowing the parent page to navigate to the source viewer at the correct location.
4. THE `SourceChip` SHALL collapse back to its compact state when the learner activates it again or presses `Escape`.
5. THE `SourceChip` SHALL be implemented as a `<button>` element (not a `<div>`) with an `aria-expanded` attribute reflecting its current state.
6. WHEN the `SourceChip` expands, THE `Canvas` SHALL announce the excerpt text to screen readers via an `aria-live="polite"` region.
7. THE `SourceChip` SHALL meet the 44×44px minimum tap target size in its compact state.
8. THE `SourceChip` expanded state SHALL display the `excerpt` text with `line-height >= 1.6` when the learner's profile has dyslexia mode enabled.
9. THE `SourceChip` SHALL use `forwardRef` so that parent components can manage focus programmatically.

---

### Requirement 8: Contradictions Banner

**User Story:** As a learner, I want to see a prominent banner when two sources disagree about a concept, so that I am aware of the contradiction and can investigate both sides rather than accepting a false consensus.

#### Acceptance Criteria

1. WHEN the `ContentGraph` passed to the `Canvas` contains at least one `RelationshipEdge` of type `"contradicts"`, THE `ContradictionsBanner` SHALL be rendered at the top of the canvas, above the React Flow viewport.
2. THE `ContradictionsBanner` SHALL display the number of contradictions detected and a brief label (e.g., "2 contradictions detected — sources disagree on these concepts").
3. THE `ContradictionsBanner` SHALL include a focusable "View contradictions" button that, when activated, filters the canvas to show only nodes and edges involved in `"contradicts"` relationships.
4. THE `ContradictionsBanner` SHALL be dismissible via a close button; WHEN dismissed, THE `Canvas` SHALL store the dismissed state in component state and SHALL NOT re-show the banner until the `ContentGraph` prop changes.
5. THE `ContradictionsBanner` SHALL use `role="status"` and `aria-live="polite"` so that screen readers announce its appearance when the graph loads.
6. THE `ContradictionsBanner` SHALL meet WCAG 2.2 Level AA contrast: 4.5:1 for all text and 3:1 for the banner border against the page background.
7. THE `ContradictionsBanner` SHALL communicate the warning state using both color (amber/red background) and a warning icon with an `aria-label`, so that color is never the only signal.
8. WHEN the `ContentGraph` contains no `"contradicts"` edges, THE `ContradictionsBanner` SHALL not be rendered.

---

### Requirement 9: Accessibility — Screen Reader Support

**User Story:** As a learner who uses a screen reader, I want every node to announce its title and type when focused, and every dynamic update to be announced via live regions, so that I can navigate and understand the infographic without visual output.

#### Acceptance Criteria

1. THE `CanvasNode` SHALL have an `aria-label` composed of the node's `title` and `NodeType` (e.g., `"Photosynthesis — concept"`), so that screen readers announce both pieces of information when the node receives focus.
2. THE `Canvas` SHALL maintain an `aria-live="polite"` region outside the React Flow viewport that announces the currently focused node's title, type, and number of connections when focus moves between nodes.
3. THE `DetailPanel` SHALL use `aria-labelledby` pointing to the panel's `<h2>` title element and `aria-describedby` pointing to the definition paragraph, so that screen readers provide a complete summary when the panel opens.
4. THE `SourceChip` SHALL have an `aria-label` that includes the source type and locator (e.g., `"Source: PDF page 12"`), and SHALL update its `aria-expanded` attribute when expanded or collapsed.
5. THE `ContradictionsBanner` SHALL have `role="status"` and an `aria-label` that includes the contradiction count (e.g., `"Alert: 2 contradictions detected"`).
6. THE `MiniMap` SHALL have `aria-hidden="true"` since it is a decorative spatial aid and its content is fully accessible via the main canvas keyboard navigation.
7. THE `Canvas` SHALL use semantic HTML: node containers use `<article>`, the detail panel uses `<aside>` or `<dialog>`, and the contradictions banner uses `<section>`.
8. WHEN the `Canvas` finishes loading and positioning nodes, THE `Canvas` SHALL announce "Graph loaded with N nodes and M connections" via an `aria-live="polite"` region.

---

### Requirement 10: Accessibility — Reduced Motion and Zoom

**User Story:** As a learner with vestibular sensitivity or who uses 200% browser zoom, I want all animations to be suppressible and the layout to remain fully usable at high zoom levels, so that the canvas does not cause discomfort or become unusable.

#### Acceptance Criteria

1. THE `Canvas` SHALL detect `prefers-reduced-motion: reduce` using a React hook and SHALL pass a `reduceMotion` flag to all Framer Motion components and the `ForceLayout` algorithm.
2. WHEN `reduceMotion` is `true`, THE `Canvas` SHALL disable all Framer Motion transition animations (layout animations, `DetailPanel` slide-in, `SourceChip` expand) and replace them with instant state changes.
3. WHEN `reduceMotion` is `true`, THE `ForceLayout` SHALL apply computed node positions in a single frame without interpolating between positions.
4. THE `Canvas` SHALL support 200% browser zoom (CSS `zoom` or `transform: scale`) without any node labels, source chips, or panel content being clipped or requiring horizontal scrolling.
5. WHEN the browser zoom level is 200%, THE `CanvasNode` minimum tap target of 44×44px SHALL remain satisfied in CSS pixels (not device pixels).
6. THE `Canvas` SHALL not use fixed pixel widths for the `DetailPanel` or `ContradictionsBanner` that would cause overflow at 200% zoom; all widths SHALL use responsive units (`%`, `rem`, `clamp`).

---

### Requirement 11: ADHD Mode — Focus Mode and Session Resume

**User Story:** As a learner with ADHD, I want a focus mode that dims non-active nodes and a session resume feature that reopens the canvas at my last position, so that I can reduce visual noise and pick up exactly where I left off.

#### Acceptance Criteria

1. WHEN the learner's profile has ADHD mode enabled, THE `Canvas` SHALL render a "Focus mode" toggle button that is always visible in the canvas toolbar.
2. WHEN `FocusMode` is active, THE `Canvas` SHALL render all `CanvasNode` components except the currently focused node at 20% opacity, using a CSS transition that respects `prefers-reduced-motion`.
3. WHEN `FocusMode` is active and the learner moves focus to a different node, THE `Canvas` SHALL update the opacity of all nodes so that only the newly focused node is at full opacity.
4. THE `Canvas` SHALL persist the current viewport position (pan offset and zoom level) and the last focused node `id` to `localStorage` under a key scoped to the `ContentGraph.id`.
5. WHEN the `Canvas` mounts and a persisted session exists for the current `ContentGraph.id`, THE `Canvas` SHALL restore the viewport position and move focus to the last focused node without animating the initial layout.
6. THE `Canvas` SHALL render a "Recap" button in the canvas toolbar that is always visible; WHEN activated, THE `Canvas` SHALL open a panel listing the last three nodes the learner interacted with (title and type), with no gamification elements.
7. THE `Canvas` SHALL not render any streak counters, urgency timers, or fire emoji in any state.

---

### Requirement 12: Dyslexia Mode — Typography and Reading Aids

**User Story:** As a learner with dyslexia, I want the canvas to apply Lexend font, increased line height, and a reading ruler when my profile has dyslexia mode enabled, so that text in nodes and the detail panel is easier to read.

#### Acceptance Criteria

1. WHEN the learner's profile has dyslexia mode enabled, THE `Canvas` SHALL apply the Lexend font (loaded via `next/font`) to all text within `CanvasNode` components and the `DetailPanel`.
2. WHEN the learner's profile has dyslexia mode enabled, THE `DetailPanel` SHALL render all prose text (definition, expanded explanation, excerpt) with `line-height >= 1.6`.
3. THE `Canvas` SHALL NEVER use italic text for emphasis in any mode; emphasis SHALL be conveyed using bold weight or color with a paired icon.
4. WHEN the learner's profile has dyslexia mode enabled, THE `Canvas` SHALL render a reading ruler overlay (a semi-transparent horizontal bar that follows the cursor/focus position) over the `DetailPanel` prose content.
5. WHEN the learner's profile has dyslexia mode enabled, THE `DetailPanel` SHALL offer a "Sentence per line" toggle that reformats the `expandedExplanation` text so each sentence appears on its own line.
6. THE `SourceChip` expanded state SHALL display the `excerpt` text with `line-height >= 1.6` when dyslexia mode is enabled.

---

### Requirement 13: Property-Based Tests — Provenance Gate Cannot Be Bypassed on the Canvas

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests that prove no `ConceptNode` without a valid `EvidenceAnchor` can ever be rendered by the canvas, so that the Provenance Gate invariant is machine-verified at the rendering layer.

#### Acceptance Criteria

1. THE `Canvas_PBT` SHALL generate arbitrary `ContentGraph` instances containing a mix of valid and invalid `ConceptNode` entries (some with empty `evidenceAnchors`) via fast-check and verify that the `Canvas` component never passes an invalid node to a `CanvasNode` renderer.
2. THE `Canvas_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs, every `CanvasNode` rendered by the `Canvas` SHALL have received a `Renderable<ConceptNode>` prop (not a raw `ConceptNode`).
3. THE `Canvas_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs containing at least one `ConceptNode` with an empty `evidenceAnchors` array, the number of rendered `CanvasNode` components SHALL be strictly less than the total number of nodes in the input graph.
4. THE `Canvas_PBT` SHALL verify the round-trip property: FOR ALL valid `ContentGraph` instances, rendering the `Canvas` and extracting the set of rendered node `id` values SHALL produce a set that is a subset of the `id` values in `ContentGraph.nodes`.
5. WHEN the `Canvas_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

---

### Requirement 14: Property-Based Tests — Keyboard Navigation Completeness

**User Story:** As a developer building the keyboard navigator, I want property-based tests that prove every node reachable in the graph is also reachable by keyboard navigation, so that no node is stranded and inaccessible to keyboard-only learners.

#### Acceptance Criteria

1. THE `KeyboardNav_PBT` SHALL generate arbitrary `ContentGraph` instances with between 1 and 50 nodes via fast-check and verify that pressing the right arrow key repeatedly from the first node eventually focuses every node in the graph exactly once before cycling back to the first node.
2. THE `KeyboardNav_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` inputs, the set of nodes reachable by keyboard navigation SHALL equal the set of nodes rendered by the `Canvas` (no stranded nodes).
3. THE `KeyboardNav_PBT` SHALL verify the round-trip property: FOR ALL `ContentGraph` inputs, navigating forward through all N nodes and then backward through all N nodes SHALL return focus to the original starting node.
4. WHEN the `KeyboardNav_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.
