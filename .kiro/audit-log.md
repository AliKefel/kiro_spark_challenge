# Agency Guardrail Audit Log

Entries are appended automatically when a file is saved. Format:
`## [timestamp] [filepath]`
`- severity: block | warn | pass`
`- rule: [rule number]`
`- detail: [finding]`

---

## 2026-04-24T00:00:00Z packages/content-graph/src/index.ts
- severity: pass
- rule: Rule 1 (Provenance Gate)
- detail: File is a stub placeholder (2 comment lines, no executable code). No ConceptNode rendering path exists yet. No bypass possible at this stage.

## 2026-04-24T00:00:00Z packages/content-graph/src/schemas/concept-node.schema.ts
- severity: pass
- rule: Rule 1 (Provenance Gate)
- detail: `ConceptNodeSchema` enforces `evidenceAnchors: z.array(EvidenceAnchorSchema).min(1)`. Any ConceptNode with an empty evidenceAnchors array is rejected at the schema boundary. The Provenance Gate is correctly encoded at the type level.

## 2026-04-24T00:00:00Z packages/content-graph/src/schemas/evidence-anchor.schema.ts
- severity: pass
- rule: Rule 1 (Provenance Gate)
- detail: `EvidenceAnchorSchema` requires a non-empty `sourceId` (UUID) and a `locator` discriminated union. Every anchor is traceable to a source document. No path exists to create an anchor without a sourceId.

## 2026-04-24T00:00:00Z packages/content-graph/tests/evidence-anchor.unit.test.ts
- severity: pass
- rule: Rule 1 (Provenance Gate)
- detail: Unit tests cover all locator variants, excerpt boundaries, page/timestamp boundaries, and UUID validation. Tests confirm invalid inputs are rejected. No test bypasses or weakens the schema constraints.

## 2026-04-24T00:00:00Z packages/content-graph/src/builder/ (empty)
- severity: warn
- rule: Rule 1 (Provenance Gate)
- detail: GraphBuilder is not yet implemented (Task 7 in tasks.md is in-progress/queued). Until GraphBuilder exists and enforces the Provenance Gate at construction time, the second enforcement layer is absent. The schema layer is present; the builder layer is pending. No violation today, but this must be resolved before any rendering path is wired up.

## 2026-04-24T00:00:00Z packages/content-graph/src/prisma/ (empty)
- severity: warn
- rule: Rule 1 (Provenance Gate)
- detail: Prisma schema is not yet implemented (Task 13 in tasks.md is queued). The database-level guard (application-level constraint documented in schema comments) is pending. No violation today; must be in place before any persistence path is wired up.

## 2026-04-24T00:00:00Z [codebase-wide scan — Rule 2]
- severity: pass
- rule: Rule 2 (No Authoritative Generation)
- detail: No code exists yet that calls an LLM or generates content. The extraction prompt instructions (Requirement 3.4 in multi-source-ingestion-pipeline spec) mandate Claude only extract claims present in source text. No violation in current code.

## 2026-04-24T00:00:00Z [codebase-wide scan — Rule 3]
- severity: pass
- rule: Rule 3 (Active Recall Gate)
- detail: No flashcard component exists in the current codebase. No reveal-without-attempt path is present. Rule 3 is not yet applicable; must be enforced when flashcard components are implemented.

## 2026-04-24T00:00:00Z [codebase-wide scan — Rule 4]
- severity: pass
- rule: Rule 4 (No Evaluation)
- detail: No scoring, grading, or correction logic exists anywhere in the current codebase. Rule 4 is not yet applicable; must be enforced when any teach-it-back or explanation feature is implemented.

## 2026-04-24T00:00:00Z [codebase-wide scan — Rule 5]
- severity: pass
- rule: Rule 5 (No Graded Homework)
- detail: No upload UI or ingestion pipeline code exists yet. The GradedAssignmentFlag rejection path (Requirement 1.3 in multi-source-ingestion-pipeline spec) is specified but not yet implemented. No violation in current code; must be enforced before the ingestion UI ships.

## 2026-04-24T00:00:00Z [codebase-wide scan — Rule 6]
- severity: pass
- rule: Rule 6 (No Authoritative Domain Advice)
- detail: No domain classification or professional-verification overlay logic exists yet. Rule 6 is not yet applicable; must be enforced when the ingestion pipeline classifies source domains.

## 2026-04-24T00:00:00Z packages/content-graph/tests/concept-node.unit.test.ts

### Rule 1 — Provenance Gate
- severity: pass
- rule: Rule 1 (Provenance Gate)
- detail: The test file explicitly tests that `ConceptNodeSchema.safeParse({ ...baseNode, evidenceAnchors: [] })` returns `success: false` (Provenance Gate test, line ~72). No test constructs or accepts a ConceptNode with an empty `evidenceAnchors` array as valid. Every valid fixture (`baseNode`, `secondAnchor`) carries at least one EvidenceAnchor with a non-empty `sourceId` UUID. No code path in this file renders or passes a ConceptNode without first going through `ConceptNodeSchema.safeParse`, which enforces `evidenceAnchors.min(1)`.

### Rule 2 — No Authoritative Generation / sourceId traceability
- severity: pass
- rule: Rule 2 (No Authoritative Generation)
- detail: All `EvidenceAnchor` fixtures in this file carry explicit `sourceId` UUID values (`SOURCE_ID`, `SOURCE_ID_2`). No anchor is constructed without a `sourceId`. The `EvidenceAnchorSchema` (imported transitively via `ConceptNodeSchema`) enforces `sourceId: z.string().uuid()` at runtime, so no generated content can exist without a traceable `sourceId`.

### Rule 3 — Active Recall Gate
- severity: pass
- rule: Rule 3 (Active Recall Gate)
- detail: No flashcard component or reveal logic is present in this file. Rule 3 is not applicable here.

### Rule 4 — No Evaluation
- severity: pass
- rule: Rule 4 (No Evaluation)
- detail: No scoring, grading, or correction logic is present in this file. Rule 4 is not applicable here.

### Rule 5 — No Graded Homework
- severity: pass
- rule: Rule 5 (No Graded Homework)
- detail: No upload UI, ingestion pipeline, or `GradedAssignmentFlag` handling is present in this file. Rule 5 is not applicable here.

