# Lattice — Architecture

## One-paragraph overview
Lattice ingests learning materials (PDFs, images, videos) and produces
an interactive content graph rendered through accessibility profiles
(ADHD and dyslexia). The AI scaffolds the learner's understanding; it
does not do the learning for them.

## Layer diagram
Source Material
    │
    ▼
[Ingestion Pipeline]  (apps/ingest, packages/content-graph)
    │ produces ConceptNode + EvidenceAnchor + RelationshipEdge
    ▼
[Provenance Gate]     (packages/content-graph)
    │ refuses unanchored nodes; returns validated graph
    ▼
[Interactive Canvas]  (apps/web, React Flow)
    │ wrapped by profile renderers
    ▼
[Profile Renderers]   (packages/renderers/adhd, packages/renderers/dyslexia)
    │
    ▼
Learner interaction (flashcards, recap, TTS, etc.)

## Where things live
- `.kiro/steering/` — always-on project rules
- `.kiro/specs/` — feature specs (requirements / design / tasks)
- `packages/content-graph/` — schema, types, Provenance Gate
- `packages/renderers/` — ADHD + dyslexia renderer layers
- `apps/web/` — Next.js frontend
- `apps/ingest/` — Python FastAPI for PDF/video parsing
- `tests/guardrail/` — property-based tests for the Agency Logic Gate

## Non-negotiables
1. No ConceptNode renders without an EvidenceAnchor.
2. No flashcard reveals without a non-empty attempt.
3. Every guardrail rule has a corresponding property-based test.