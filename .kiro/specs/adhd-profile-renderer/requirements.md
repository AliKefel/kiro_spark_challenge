# Requirements Document

## Introduction

The ADHD Profile Renderer is a set of React components and canvas modifiers that transform the default Lattice interactive-canvas experience for learners with ADHD. It layers five independently toggleable components on top of the existing `Canvas` from the `interactive-canvas` spec: `FocusMode`, `RecapButton`, `WorkingMemoryPanel`, `BodyDoubleTimer`, and `SessionResume`. All components are governed by the Agency Guardrail — none of them do the learning for the student. All components meet WCAG 2.2 AA. Profile state is stored in a single exportable JSON object the learner owns.

The renderer deliberately excludes streak counters, urgency timers, red/urgent color states, fire emoji, and all gamification chrome. These are anti-requirements enforced at the component level.

---

## Glossary

- **ADHDProfile**: The single JSON object that holds the on/off state for every ADHD-mode component. Owned by the learner and exportable.
- **ADHDProfileRenderer**: The top-level wrapper component that reads `ADHDProfile` and conditionally renders each sub-component.
- **FocusMode**: A canvas modifier that dims all non-active `CanvasNode` components to 20% opacity, with neighbors at 60% and the active node at 100%.
- **ActiveNode**: The `CanvasNode` that currently holds keyboard or pointer focus within the `Canvas`.
- **NeighborNode**: A `CanvasNode` directly connected to the `ActiveNode` by at least one `RelationshipEdge`.
- **RecapButton**: An always-visible toolbar button that produces a 2-sentence plain-text summary of the last 3 nodes the learner interacted with, derived from `SessionState`.
- **SessionState**: An in-memory record of the learner's interactions during the current browser session: nodes visited, concepts expanded, flashcards completed.
- **WorkingMemoryPanel**: A pinned sidebar listing up to 10 facts established during the current session. Facts are added when the learner expands a node or completes a flashcard. When the list is full, the oldest fact rotates out.
- **Fact**: A short string derived from a `ConceptNode` title and definition, added to `WorkingMemoryPanel` when the learner expands that node or completes a flashcard for it.
- **BodyDoubleTimer**: An optional, dismissible presence indicator that shows a calm "studying alongside you" state. Every 5–7 minutes it surfaces a single gentle check-in prompt. Never modal, never shame-based.
- **CheckIn**: The gentle prompt surfaced by `BodyDoubleTimer` (e.g., "how's it going?"). Dismissible with a single action. Never blocks interaction.
- **SessionResume**: The mechanism that persists the exact viewport scroll position, zoom level, and last `ActiveNode` id to `localStorage`, and restores them when the learner returns to the same `ContentGraph`.
- **PersistedSession**: The `localStorage` entry keyed by `ContentGraph.id` that stores viewport state and last active node id for `SessionResume`.
- **Canvas**: The React Flow–based interactive surface defined in the `interactive-canvas` spec.
- **CanvasNode**: A React Flow custom node component as defined in the `interactive-canvas` spec.
- **ContentGraph**: The top-level container holding all `ConceptNode` and `RelationshipEdge` entries, as defined in the `content-graph-data-model` spec.
- **ConceptNode**: A single discrete idea extracted from source material, as defined in the `content-graph-data-model` spec.
- **RelationshipEdge**: A directed, typed connection between two `ConceptNode` entries, as defined in the `content-graph-data-model` spec.
- **prefers-reduced-motion**: The CSS media feature and corresponding React hook used to disable or replace animations for learners who have requested reduced motion.
- **WCAG 2.2 AA**: The accessibility conformance level required for all components in this spec.

---

## Requirements

### Requirement 1: ADHDProfile State Object

**User Story:** As a learner with ADHD, I want my ADHD-mode preferences stored in a single JSON object that I own and can export, so that my configuration is portable and not locked into the application.

#### Acceptance Criteria

1. THE `ADHDProfileRenderer` SHALL read component visibility and configuration from a single `ADHDProfile` JSON object passed as a prop.
2. THE `ADHDProfile` SHALL contain independent boolean fields for each component: `focusModeEnabled`, `recapButtonVisible`, `workingMemoryPanelVisible`, `bodyDoubleTimerEnabled`, and `sessionResumeEnabled`.
3. THE `ADHDProfileRenderer` SHALL expose an `onProfileChange` callback that emits the updated `ADHDProfile` object whenever any field changes, so that the parent can persist the new state.
4. THE `ADHDProfile` object SHALL be serialisable to and from JSON without data loss.
5. THE `ADHDProfileRenderer` SHALL render each sub-component independently based on its corresponding `ADHDProfile` field; disabling one component SHALL NOT affect the rendering of any other component.
6. FOR ALL valid `ADHDProfile` inputs, serialising the profile to JSON and deserialising it SHALL produce an object that is deeply equal to the original (round-trip property).

---

### Requirement 2: FocusMode — Opacity Dimming of Non-Active Nodes

**User Story:** As a learner with ADHD, I want non-active nodes dimmed when Focus Mode is on, so that I can concentrate on one concept at a time without visual noise from the rest of the graph.

#### Acceptance Criteria

1. WHEN `focusModeEnabled` is `true` in `ADHDProfile`, THE `Canvas` SHALL render a "Focus mode" toggle button in the canvas toolbar that is always visible and reflects the current active/inactive state.
2. WHEN `FocusMode` is active, THE `FocusMode` modifier SHALL render every `CanvasNode` that is neither the `ActiveNode` nor a `NeighborNode` at 20% opacity.
3. WHEN `FocusMode` is active, THE `FocusMode` modifier SHALL render every `NeighborNode` at 60% opacity.
4. WHEN `FocusMode` is active, THE `FocusMode` modifier SHALL render the `ActiveNode` at 100% opacity.
5. WHEN `FocusMode` is active and the `ActiveNode` changes, THE `FocusMode` modifier SHALL update all node opacities to reflect the new `ActiveNode` and its new `NeighborNode` set.
6. WHEN `prefers-reduced-motion` is not set to `reduce`, THE `FocusMode` modifier SHALL apply opacity changes using a CSS transition with a duration of no more than 200ms.
7. WHEN `prefers-reduced-motion` is set to `reduce`, THE `FocusMode` modifier SHALL apply opacity changes immediately without a CSS transition.
8. WHEN `FocusMode` is toggled off, THE `FocusMode` modifier SHALL restore all `CanvasNode` components to 100% opacity.
9. THE `FocusMode` toggle button SHALL have an `aria-pressed` attribute reflecting the current active/inactive state, and an `aria-label` of `"Focus mode"`.
10. THE `FocusMode` toggle button SHALL meet the 44×44px minimum tap target size and WCAG 2.2 AA contrast requirements.
11. IF the `Canvas` contains no `ActiveNode` (no node has been focused yet), THEN THE `FocusMode` modifier SHALL render all nodes at 100% opacity until the learner focuses a node.

---

### Requirement 3: RecapButton — Session Interaction Summary

**User Story:** As a learner with ADHD, I want a one-tap recap of my last three interactions, so that I can re-orient quickly after a distraction without having to retrace my steps manually.

#### Acceptance Criteria

1. WHEN `recapButtonVisible` is `true` in `ADHDProfile`, THE `RecapButton` SHALL be rendered in the canvas toolbar and SHALL remain visible at all times regardless of canvas scroll or zoom state.
2. WHEN the learner activates the `RecapButton` (click, tap, or `Enter`/`Space` key), THE `RecapButton` SHALL open a non-modal panel displaying a 2-sentence plain-text summary of the last 3 nodes the learner interacted with (visited or expanded).
3. THE `RecapButton` summary panel SHALL derive its content exclusively from `SessionState`; THE `RecapButton` SHALL NOT make any network request or LLM call to generate the summary.
4. THE `RecapButton` summary SHALL include the title and node type of each of the last 3 interacted nodes, presented in reverse chronological order (most recent first).
5. IF fewer than 3 nodes have been interacted with in the current session, THEN THE `RecapButton` summary SHALL list only the nodes that have been interacted with, without placeholder or filler text.
6. THE `RecapButton` summary panel SHALL be dismissible via a close button or by pressing `Escape`, returning focus to the `RecapButton`.
7. THE `RecapButton` summary panel SHALL use `role="dialog"` with `aria-labelledby` pointing to the panel title, and SHALL trap focus within the panel while open.
8. THE `RecapButton` summary panel SHALL NOT contain any gamification elements, streak counters, urgency language, or fire emoji.
9. THE `RecapButton` SHALL have an `aria-label` of `"Recap last 3 interactions"` and SHALL meet the 44×44px minimum tap target size.
10. WHEN the `RecapButton` summary panel opens, THE `RecapButton` SHALL move focus to the first interactive element inside the panel (the close button).

---

### Requirement 4: WorkingMemoryPanel — Session Facts Sidebar

**User Story:** As a learner with ADHD, I want a pinned sidebar listing the facts I've established this session, so that I can offload working memory to the screen and focus on understanding new concepts.

#### Acceptance Criteria

1. WHEN `workingMemoryPanelVisible` is `true` in `ADHDProfile`, THE `WorkingMemoryPanel` SHALL be rendered as a pinned sidebar anchored to the left side of the canvas viewport.
2. WHEN a learner expands a `CanvasNode` (opens the `DetailPanel`), THE `WorkingMemoryPanel` SHALL add a `Fact` derived from that node's `title` and `definition` to the top of the facts list.
3. WHEN a learner completes a flashcard for a `ConceptNode`, THE `WorkingMemoryPanel` SHALL add a `Fact` derived from that node's `title` and `definition` to the top of the facts list.
4. THE `WorkingMemoryPanel` SHALL display a maximum of 10 `Fact` entries at any time.
5. WHEN a new `Fact` is added and the list already contains 10 entries, THE `WorkingMemoryPanel` SHALL remove the oldest `Fact` from the list before adding the new one.
6. THE `WorkingMemoryPanel` SHALL NOT add a duplicate `Fact` if the same node has already been added during the current session; THE `WorkingMemoryPanel` SHALL silently skip the duplicate.
7. THE `WorkingMemoryPanel` SHALL announce each newly added `Fact` to screen readers via an `aria-live="polite"` region.
8. THE `WorkingMemoryPanel` SHALL be implemented as a `<nav>` or `<aside>` element with an accessible name of `"Working memory — facts this session"`.
9. THE `WorkingMemoryPanel` SHALL support 200% browser zoom without any fact text being clipped or requiring horizontal scrolling.
10. THE `WorkingMemoryPanel` SHALL NOT contain any gamification elements, progress bars, completion percentages, or urgency indicators.
11. FOR ALL sequences of node expansions, the number of entries in `WorkingMemoryPanel` SHALL never exceed 10 (invariant).

---

### Requirement 5: BodyDoubleTimer — Calm Presence Indicator

**User Story:** As a learner with ADHD, I want an optional calm presence indicator that checks in with me periodically, so that I feel less alone while studying without being pressured or shamed.

#### Acceptance Criteria

1. WHEN `bodyDoubleTimerEnabled` is `true` in `ADHDProfile`, THE `BodyDoubleTimer` SHALL render a persistent, non-intrusive presence indicator in the canvas UI showing a "studying alongside you" state.
2. THE `BodyDoubleTimer` presence indicator SHALL be dismissible via a close button at any time; WHEN dismissed, THE `BodyDoubleTimer` SHALL remove the indicator from the UI for the remainder of the session without re-showing it.
3. WHILE `BodyDoubleTimer` is active and not dismissed, THE `BodyDoubleTimer` SHALL surface a `CheckIn` prompt at a random interval between 5 and 7 minutes after the previous `CheckIn` was dismissed or the timer started.
4. THE `CheckIn` prompt SHALL be a single, calm, non-judgmental question (e.g., "how's it going?") rendered as a non-modal, non-blocking overlay element.
5. THE `CheckIn` prompt SHALL be dismissible with a single action (click, tap, or `Enter`/`Space` key on the dismiss button); WHEN dismissed, THE `BodyDoubleTimer` SHALL schedule the next `CheckIn` at a new random interval between 5 and 7 minutes.
6. THE `CheckIn` prompt SHALL NEVER be rendered as a modal dialog that blocks canvas interaction.
7. THE `CheckIn` prompt SHALL NOT contain urgency language, shame-based language, streak references, time-away references, or fire emoji.
8. THE `CheckIn` prompt SHALL NOT contain any red or urgent color states.
9. THE `CheckIn` prompt SHALL have `role="status"` and `aria-live="polite"` so that screen readers announce its appearance without interrupting the learner's current focus.
10. THE `CheckIn` dismiss button SHALL have an `aria-label` of `"Dismiss check-in"` and SHALL meet the 44×44px minimum tap target size.
11. THE `BodyDoubleTimer` presence indicator SHALL meet WCAG 2.2 AA contrast requirements for all text and UI elements.
12. WHEN `prefers-reduced-motion` is set to `reduce`, THE `BodyDoubleTimer` SHALL render the `CheckIn` prompt without entrance or exit animations.
13. IF the learner has not interacted with the canvas for more than 30 minutes, THEN THE `BodyDoubleTimer` SHALL pause the check-in interval and SHALL NOT surface a `CheckIn` prompt until the learner next interacts with the canvas.

---

### Requirement 6: SessionResume — Exact State Persistence

**User Story:** As a learner with ADHD, I want the canvas to reopen exactly where I left off, so that I do not lose my place or have to re-orient after closing and reopening the app.

#### Acceptance Criteria

1. WHEN `sessionResumeEnabled` is `true` in `ADHDProfile`, THE `SessionResume` mechanism SHALL persist the current viewport pan offset, zoom level, and last `ActiveNode` id to `localStorage` under a key scoped to `ContentGraph.id` after every interaction that changes any of these values.
2. THE `PersistedSession` entry in `localStorage` SHALL be a JSON object containing: `panX`, `panY`, `zoom`, `lastActiveNodeId`, and `timestamp`.
3. WHEN the `Canvas` mounts with `sessionResumeEnabled` set to `true` and a `PersistedSession` exists for the current `ContentGraph.id`, THE `SessionResume` mechanism SHALL restore the viewport to the persisted `panX`, `panY`, and `zoom` values without animating the initial layout transition.
4. WHEN the `Canvas` mounts and a `PersistedSession` exists, THE `SessionResume` mechanism SHALL move focus to the `CanvasNode` identified by `lastActiveNodeId` if that node is present in the current `ContentGraph`.
5. IF the `CanvasNode` identified by `lastActiveNodeId` is no longer present in the current `ContentGraph`, THEN THE `SessionResume` mechanism SHALL restore the viewport position only and SHALL move focus to the first node in `ContentGraph.nodes` without throwing a runtime error.
6. THE `SessionResume` mechanism SHALL update the `PersistedSession` entry at most once per second (debounced) to avoid excessive `localStorage` writes during continuous pan or zoom gestures.
7. THE `SessionResume` mechanism SHALL NOT store any `ConceptNode` content, `EvidenceAnchor` data, or learner-generated text in `localStorage`; only viewport geometry and node id are persisted.
8. WHEN `sessionResumeEnabled` is toggled from `true` to `false` in `ADHDProfile`, THE `SessionResume` mechanism SHALL delete the `PersistedSession` entry for the current `ContentGraph.id` from `localStorage`.
9. FOR ALL valid viewport states (pan offset and zoom level within the `Canvas` supported range), serialising the `PersistedSession` to JSON and deserialising it SHALL produce a viewport state that restores the canvas to a visually equivalent position (round-trip property).

---

### Requirement 7: Anti-Requirements — Prohibited UI Patterns

**User Story:** As a learner with ADHD, I want the application to never show me streak counters, urgency prompts, or shame-based UI, so that the tool supports my focus without adding anxiety or pressure.

#### Acceptance Criteria

1. THE `ADHDProfileRenderer` SHALL NOT render any streak counter, streak badge, or streak-related UI element in any state.
2. THE `ADHDProfileRenderer` SHALL NOT render any prompt, notification, or message that references the duration of the learner's absence (e.g., "you've been away for 3 days").
3. THE `ADHDProfileRenderer` SHALL NOT use red, orange-red, or any color conventionally associated with urgency or error states for time-related UI elements.
4. THE `ADHDProfileRenderer` SHALL NOT render fire emoji (🔥), trophy emoji (🏆), or any gamification chrome (badges, points, leaderboards, level indicators) in any state.
5. THE `ADHDProfileRenderer` SHALL NOT render any timed interaction that cannot be paused, extended, or dismissed by the learner (accessibility standard rule 12).
6. IF any sub-component receives a prop or state value that would cause it to render a prohibited UI pattern, THEN THE `ADHDProfileRenderer` SHALL throw a development-mode error identifying the violation and SHALL render nothing in place of the offending element in production mode.

---

### Requirement 8: Independent Toggling and Profile Composition

**User Story:** As a learner with ADHD, I want to turn each ADHD-mode component on or off independently, so that I can build the exact combination of supports that works for my specific needs.

#### Acceptance Criteria

1. THE `ADHDProfileRenderer` SHALL render each of the five components (`FocusMode`, `RecapButton`, `WorkingMemoryPanel`, `BodyDoubleTimer`, `SessionResume`) independently based solely on its corresponding `ADHDProfile` field.
2. WHEN any single `ADHDProfile` field is toggled, THE `ADHDProfileRenderer` SHALL re-render only the affected component and SHALL NOT unmount or reset the state of any other component.
3. THE `ADHDProfileRenderer` SHALL support simultaneous activation of all five components without layout conflicts or z-index collisions.
4. WHEN the learner's profile has both ADHD mode and dyslexia mode enabled, THE `ADHDProfileRenderer` SHALL apply ADHD-mode components without overriding dyslexia-mode typography settings (Lexend font, `line-height >= 1.6`, no italics).
5. THE `ADHDProfileRenderer` SHALL expose a single `onProfileChange` callback; WHEN any component updates its own state, THE `ADHDProfileRenderer` SHALL emit the complete updated `ADHDProfile` object via `onProfileChange`.
6. FOR ALL combinations of boolean values in `ADHDProfile`, THE `ADHDProfileRenderer` SHALL render without throwing a runtime error (invariant over all 2^5 = 32 possible toggle combinations).

---

### Requirement 9: Accessibility — All ADHD Components

**User Story:** As a learner with ADHD who uses assistive technology, I want every ADHD-mode component to be fully keyboard-navigable and screen-reader-compatible, so that the accessibility supports do not themselves create accessibility barriers.

#### Acceptance Criteria

1. THE `FocusMode` toggle button, `RecapButton`, `WorkingMemoryPanel`, `BodyDoubleTimer` dismiss button, and all interactive elements within these components SHALL be reachable and operable by keyboard alone.
2. THE `WorkingMemoryPanel` SHALL render each `Fact` as a list item within a `<ul>` element, with each item's text meeting WCAG 2.2 AA contrast of 4.5:1 against the panel background.
3. THE `RecapButton` summary panel SHALL announce its opening to screen readers via an `aria-live="assertive"` region scoped to the panel container.
4. WHEN `FocusMode` changes the opacity of `CanvasNode` components, THE `FocusMode` modifier SHALL NOT change the `aria-hidden` state of dimmed nodes; dimmed nodes SHALL remain reachable by keyboard and screen reader navigation.
5. THE `BodyDoubleTimer` `CheckIn` prompt SHALL appear in the DOM after the main canvas content so that it does not interrupt the reading order for screen reader users.
6. ALL interactive elements across all five components SHALL have visible focus indicators meeting WCAG 2.2 AA: `focus-visible:ring-2 ring-offset-2`.
7. ALL text within all five components SHALL meet WCAG 2.2 AA contrast: 4.5:1 for body text and 3:1 for UI component borders.
8. THE `WorkingMemoryPanel` close button (if present) and the `BodyDoubleTimer` dismiss button SHALL each have an explicit `aria-label` and meet the 44×44px minimum tap target size.

---

### Requirement 10: Property-Based Tests — ADHDProfile Invariants

**User Story:** As a developer building the ADHD renderer, I want property-based tests that verify the core invariants of the profile state machine and component rendering, so that edge cases in toggle combinations and session state are machine-verified.

#### Acceptance Criteria

1. THE `ADHDProfile_PBT` SHALL generate arbitrary `ADHDProfile` objects (all 32 boolean combinations) via fast-check and verify that `ADHDProfileRenderer` renders without throwing a runtime error for every combination.
2. THE `ADHDProfile_PBT` SHALL verify the round-trip property: FOR ALL valid `ADHDProfile` objects, serialising to JSON and deserialising SHALL produce an object deeply equal to the original.
3. THE `WorkingMemory_PBT` SHALL generate arbitrary sequences of node expansion events (between 1 and 50 events) via fast-check and verify that the `WorkingMemoryPanel` fact list never exceeds 10 entries after any sequence (invariant).
4. THE `WorkingMemory_PBT` SHALL verify the idempotence property: FOR ALL sequences of node expansion events, expanding the same node multiple times SHALL result in exactly one `Fact` entry for that node in the `WorkingMemoryPanel`.
5. THE `SessionResume_PBT` SHALL generate arbitrary viewport states (pan offset within ±10,000px, zoom between 0.25 and 4.0) via fast-check and verify the round-trip property: serialising a viewport state to `PersistedSession` JSON and deserialising it SHALL restore a viewport state that is numerically equal to the original within floating-point tolerance.
6. THE `FocusMode_PBT` SHALL generate arbitrary `ContentGraph` instances (1 to 50 nodes) and arbitrary `ActiveNode` selections via fast-check and verify the invariant: the sum of all rendered node opacities SHALL equal `(number of NeighborNodes × 0.6) + 1.0 + (number of non-neighbor, non-active nodes × 0.2)`.
7. WHEN the `ADHDProfile_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

