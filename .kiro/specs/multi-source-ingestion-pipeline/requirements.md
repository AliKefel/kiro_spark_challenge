# Requirements Document

## Introduction

The multi-source ingestion pipeline is the core processing backbone of Lattice. It accepts heterogeneous learning materials — PDFs (text and scanned), images of handwritten notes or whiteboards, YouTube URLs, and audio files — and produces a single unified `ContentGraph` whose nodes and edges are fully anchored to their source material.

The pipeline's defining capability is **contradiction detection**: when two or more sources discuss the same concept, the pipeline classifies the relationship as agreement, complement, or contradiction and emits the appropriate `RelationshipEdge` (including `"contradicts"` edges backed by evidence from both sides). Every emitted `ConceptNode` must pass the Provenance Gate before it enters the graph.

The pipeline is split across two execution environments: a Python FastAPI microservice (`apps/ingest/`) handles all binary parsing (PDF text extraction, OCR, audio transcription, YouTube transcript fetching), and Next.js Server Actions orchestrate the Claude-powered extraction, alignment, reconciliation, and graph-build stages. The demo target is a 30-page PDF plus a 14-minute YouTube video producing a full graph in under 90 seconds.

---

## Glossary

- **Pipeline**: The end-to-end process that transforms one or more raw source inputs into a single `ContentGraph`.
- **IngestService**: The Python FastAPI microservice (`apps/ingest/`) responsible for Stage 1 (parsing raw sources into normalized text and structural markers).
- **Orchestrator**: The Next.js Server Action layer responsible for Stages 2–5 (extract, align, reconcile, graph-build).
- **NormalizedDocument**: The structured output of Stage 1 — normalized text plus structural markers (headings, page breaks, timestamps, image regions) — produced for each source.
- **SourceType**: A discriminated union of the four accepted input kinds: `"pdf"`, `"image"`, `"youtube"`, `"audio"`.
- **CandidateNode**: A provisional `ConceptNode` produced by Claude during Stage 2 (Extract), not yet aligned or validated against the Provenance Gate.
- **AlignmentGroup**: A set of `CandidateNode` entries from different sources that the Aligner has determined refer to the same concept, based on semantic similarity.
- **ReconciliationClass**: The classification assigned to an `AlignmentGroup` after Stage 4: `"agree"`, `"complement"`, or `"contradict"`.
- **Aligner**: The component in Stage 3 that matches `CandidateNode` entries across sources by semantic similarity to form `AlignmentGroup` entries.
- **Reconciler**: The component in Stage 4 that classifies each `AlignmentGroup` as `"agree"`, `"complement"`, or `"contradict"` and produces the evidence needed for `RelationshipEdge` construction.
- **GraphBuilder**: The `GraphBuilder` API defined in the `content-graph-data-model` spec, used in Stage 5 to assemble the final `ContentGraph`.
- **ProvenanceGate**: Agency Guardrail Rule 1 — every `ConceptNode` must have at least one valid `EvidenceAnchor` before it is added to the graph or rendered.
- **EvidenceAnchor**: A pointer to the exact location in a source document backing a claim, as defined in the `content-graph-data-model` spec.
- **ConceptNode**: A single discrete idea extracted from source material, as defined in the `content-graph-data-model` spec.
- **RelationshipEdge**: A directed, typed connection between two `ConceptNode` entries, as defined in the `content-graph-data-model` spec.
- **ContentGraph**: The top-level container holding all nodes, edges, and source metadata for a learning session, as defined in the `content-graph-data-model` spec.
- **GradedAssignmentFlag**: A boolean flag set by the learner at upload time indicating the source material is a graded assignment (Agency Guardrail Rule 5).
- **DomainClassification**: A classification of ingested content as `"medical"`, `"legal"`, `"psychological"`, or `"general"` (Agency Guardrail Rule 6).
- **IngestionJob**: A persisted record tracking the status, progress, and result of a single pipeline run across all five stages.
- **IngestionProgress**: A server-sent event stream emitting stage-level progress updates to the client during pipeline execution.
- **pdf-parse**: The Node.js library used to extract text from text-based PDFs.
- **Claude Vision**: Anthropic Claude Sonnet 4.5's vision capability, used for OCR on scanned PDFs and image inputs.
- **Whisper**: OpenAI's audio transcription model, used as the primary transcription path for audio files and as the fallback for YouTube videos when a transcript is unavailable.
- **youtube-transcript**: The npm package used as the primary transcript-fetch path for YouTube URLs.
- **SemanticSimilarityThreshold**: The minimum cosine similarity score (default 0.82) above which two `CandidateNode` entries are considered to refer to the same concept and placed in the same `AlignmentGroup`.
- **ContradictionConfidenceThreshold**: The minimum confidence score (default 0.70) required for the Reconciler to emit a `"contradicts"` edge rather than a `"complement"` edge.
- **Zod**: The TypeScript-first runtime validation library used at every input boundary in the pipeline.

---

## Requirements

### Requirement 1: Source Input Acceptance and Validation

**User Story:** As a learner, I want to submit PDFs, images, YouTube URLs, and audio files to the pipeline, so that all my course materials can be processed regardless of format.

#### Acceptance Criteria

1. THE `Orchestrator` SHALL accept a batch input containing one or more sources, where each source is one of: a PDF file (`.pdf`), an image file (`.png`, `.jpg`, `.jpeg`, `.webp`), a YouTube URL (`https://www.youtube.com/watch?v=*` or `https://youtu.be/*`), or an audio file (`.mp3`, `.wav`, `.m4a`).
2. THE `Orchestrator` SHALL validate each source against a Zod schema at the input boundary before any processing begins, returning a structured validation error for any source that fails.
3. WHEN a learner submits a source with the `GradedAssignmentFlag` set to `true`, THE `Orchestrator` SHALL immediately reject the entire batch with the reason `"graded-assignment-refused"` and SHALL NOT process any source in the batch (Agency Guardrail Rule 5).
4. THE `Orchestrator` SHALL accept a batch of up to 10 sources in a single pipeline run.
5. IF a submitted file exceeds 100 MB, THEN THE `Orchestrator` SHALL return a validation error identifying the file and the size limit before forwarding to the `IngestService`.
6. IF a submitted YouTube URL does not match the accepted URL patterns, THEN THE `Orchestrator` SHALL return a validation error identifying the invalid URL.
7. THE `Orchestrator` SHALL assign a unique UUID `sourceId` to each accepted source before forwarding to Stage 1, and SHALL register all `sourceId` values with the `GraphBuilder` via `addSource`.

---

### Requirement 2: Stage 1 — Ingest (Raw Source Parsing)

**User Story:** As a developer building the extraction stage, I want each source type parsed into a normalized document with structural markers, so that Stage 2 can operate on consistent text regardless of the original format.

#### Acceptance Criteria

1. WHEN the `IngestService` receives a text-based PDF, THE `IngestService` SHALL extract text using `pdf-parse` and produce a `NormalizedDocument` containing the full text segmented by page number.
2. WHEN the `IngestService` receives a scanned PDF (a PDF where `pdf-parse` returns fewer than 50 characters per page on average), THE `IngestService` SHALL fall back to Claude Vision OCR and produce a `NormalizedDocument` containing the extracted text segmented by page number.
3. WHEN the `IngestService` receives an image file, THE `IngestService` SHALL send the image to Claude Vision and produce a `NormalizedDocument` containing the OCR-extracted text and any identified structural regions (headings, bullet lists, diagrams).
4. WHEN the `IngestService` receives a YouTube URL, THE `IngestService` SHALL first attempt to fetch the transcript using the `youtube-transcript` package and produce a `NormalizedDocument` containing the transcript text segmented by timestamp in seconds.
5. WHEN the `youtube-transcript` package returns an error or an empty transcript for a YouTube URL, THE `IngestService` SHALL fall back to downloading the audio stream and transcribing it with Whisper, producing a `NormalizedDocument` segmented by timestamp in seconds.
6. WHEN the `IngestService` receives an audio file, THE `IngestService` SHALL transcribe it using Whisper and produce a `NormalizedDocument` containing the transcript text segmented by timestamp in seconds.
7. THE `IngestService` SHALL attach the assigned `sourceId` and `SourceType` to every `NormalizedDocument` it produces.
8. THE `IngestService` SHALL expose a `/ingest` POST endpoint that accepts a multipart form payload and returns a JSON array of `NormalizedDocument` objects validated against a Pydantic schema.
9. IF the `IngestService` cannot produce a `NormalizedDocument` for a source (e.g., corrupt file, network failure fetching YouTube audio), THEN THE `IngestService` SHALL return a structured error response identifying the `sourceId` and failure reason, and the `Orchestrator` SHALL surface this error to the learner without aborting processing of the remaining sources.
10. THE `IngestService` SHALL complete Stage 1 for a 30-page PDF in under 20 seconds and for a 14-minute YouTube video in under 40 seconds when running on the target demo hardware.

---

### Requirement 3: Stage 2 — Extract (Concept Candidate Generation)

**User Story:** As a developer building the graph construction pipeline, I want Claude to extract candidate concept nodes from each normalized document independently, so that each source's concepts are identified before cross-source alignment begins.

#### Acceptance Criteria

1. WHEN the `Orchestrator` receives a `NormalizedDocument`, THE `Orchestrator` SHALL send the document text to Claude Sonnet 4.5 with a structured prompt requesting extraction of `CandidateNode` entries, each containing a `title`, `definition`, `depth`, `tags`, and at least one `EvidenceAnchor` pointing to the source location.
2. THE `Orchestrator` SHALL validate every `CandidateNode` returned by Claude against the `ConceptNode_Schema` Zod schema before accepting it into the pipeline.
3. WHEN Claude returns a `CandidateNode` with an empty `evidenceAnchors` array, THE `Orchestrator` SHALL discard that candidate and log a warning identifying the `title` and `sourceId` (Agency Guardrail Rule 1 — Provenance Gate).
4. THE `Orchestrator` SHALL instruct Claude via the extraction prompt that it MUST only extract claims explicitly present in the provided document text and MUST NOT generate, infer, or synthesize claims not directly supported by the source (Agency Guardrail Rule 2).
5. WHEN the `NormalizedDocument` has a `SourceType` of `"pdf"`, THE `Orchestrator` SHALL construct `EvidenceAnchor` locators of type `{ type: "pdf"; page: number }` using the page segmentation from the `NormalizedDocument`.
6. WHEN the `NormalizedDocument` has a `SourceType` of `"youtube"` or `"audio"`, THE `Orchestrator` SHALL construct `EvidenceAnchor` locators of type `{ type: "video"; timestampSeconds: number }` using the timestamp segmentation from the `NormalizedDocument`.
7. WHEN the `NormalizedDocument` has a `SourceType` of `"image"`, THE `Orchestrator` SHALL construct `EvidenceAnchor` locators of type `{ type: "image"; region: { x, y, width, height } }` using the structural regions identified in the `NormalizedDocument`.
8. THE `Orchestrator` SHALL process Stage 2 for all sources in the batch concurrently (one Claude call per source in parallel) rather than sequentially.
9. THE `Orchestrator` SHALL classify the `DomainClassification` of each source during extraction; WHEN a source is classified as `"medical"`, `"legal"`, or `"psychological"`, THE `Orchestrator` SHALL attach a `domainFlag` to all `CandidateNode` entries from that source (Agency Guardrail Rule 6).

---

### Requirement 4: Stage 3 — Align (Cross-Source Concept Matching)

**User Story:** As a developer building the contradiction detection feature, I want the pipeline to identify which concepts from different sources refer to the same idea, so that the reconciliation stage can compare them accurately.

#### Acceptance Criteria

1. WHEN Stage 2 produces `CandidateNode` entries from two or more sources, THE `Aligner` SHALL group candidates into `AlignmentGroup` entries where each group contains candidates from different sources that refer to the same concept.
2. THE `Aligner` SHALL use Claude Sonnet 4.5 to compute semantic similarity between `CandidateNode` titles and definitions across sources, grouping candidates whose similarity score meets or exceeds the `SemanticSimilarityThreshold` of 0.82.
3. WHEN a `CandidateNode` does not meet the `SemanticSimilarityThreshold` with any candidate from another source, THE `Aligner` SHALL place it in a singleton `AlignmentGroup` containing only that candidate.
4. THE `Aligner` SHALL ensure that each `CandidateNode` appears in exactly one `AlignmentGroup`.
5. THE `Aligner` SHALL produce a structured `AlignmentGroup` record for each group containing: the list of `CandidateNode` entries, the list of contributing `sourceId` values, and the computed similarity scores between each pair of candidates in the group.
6. WHEN the batch contains only a single source, THE `Aligner` SHALL place each `CandidateNode` in its own singleton `AlignmentGroup` and proceed to Stage 4 without performing cross-source comparison.

---

### Requirement 5: Stage 4 — Reconcile (Contradiction Classification)

**User Story:** As a learner, I want the pipeline to detect when two sources make incompatible claims about the same concept, so that I can see both sides of a disagreement rather than a false consensus.

#### Acceptance Criteria

1. WHEN the `Reconciler` processes an `AlignmentGroup` containing candidates from two or more sources, THE `Reconciler` SHALL classify the group as exactly one of: `"agree"`, `"complement"`, or `"contradict"`.
2. THE `Reconciler` SHALL classify an `AlignmentGroup` as `"agree"` when all candidate definitions in the group make compatible, non-contradictory claims about the same concept.
3. THE `Reconciler` SHALL classify an `AlignmentGroup` as `"complement"` when the candidate definitions cover distinct, non-overlapping aspects of the same concept without making incompatible claims.
4. THE `Reconciler` SHALL classify an `AlignmentGroup` as `"contradict"` when at least two candidate definitions make directly incompatible claims about the same concept and the Reconciler's confidence score meets or exceeds the `ContradictionConfidenceThreshold` of 0.70.
5. WHEN the `Reconciler` classifies an `AlignmentGroup` as `"contradict"`, THE `Reconciler` SHALL produce a `RelationshipEdge` of type `"contradicts"` with `evidenceAnchors` containing at least one `EvidenceAnchor` from each contradicting source.
6. WHEN the `Reconciler` classifies an `AlignmentGroup` as `"agree"` or `"complement"`, THE `Reconciler` SHALL produce a `RelationshipEdge` of type `"elaborates"` or `"contains"` respectively, connecting the merged concept nodes.
7. WHEN the `Reconciler`'s confidence score for a potential contradiction falls below the `ContradictionConfidenceThreshold`, THE `Reconciler` SHALL classify the group as `"complement"` rather than `"contradict"` and SHALL NOT emit a `"contradicts"` edge.
8. THE `Reconciler` SHALL use Claude Sonnet 4.5 to perform classification, providing the full candidate definitions and their source excerpts as context.
9. THE `Reconciler` SHALL attach the `ReconciliationClass` and confidence score to each `AlignmentGroup` record for observability and downstream logging.
10. THE `Reconciler` SHALL NOT resolve contradictions by selecting one source as authoritative — both sides SHALL be preserved in the graph with their respective `EvidenceAnchor` entries (Agency Guardrail Rule 2).

---

### Requirement 6: Stage 5 — Graph Build (ContentGraph Assembly)

**User Story:** As a developer building the graph rendering layer, I want the pipeline to produce a single validated `ContentGraph` from all aligned and reconciled concepts, so that the renderer receives a complete, provenance-verified graph ready for display.

#### Acceptance Criteria

1. WHEN Stage 4 completes, THE `Orchestrator` SHALL instantiate a `GraphBuilder` and register all `sourceId` values via `addSource` before adding any nodes or edges.
2. THE `Orchestrator` SHALL merge all `CandidateNode` entries within each `AlignmentGroup` into a single `ConceptNode`, combining their `evidenceAnchors` arrays so that the merged node carries anchors from every contributing source.
3. WHEN merging `CandidateNode` entries within an `AlignmentGroup`, THE `Orchestrator` SHALL use the `definition` from the candidate with the highest word count as the primary definition, and SHALL concatenate all unique `tags` from all candidates.
4. THE `Orchestrator` SHALL add each merged `ConceptNode` to the `GraphBuilder` via `addNode`, and SHALL discard any node rejected by the `GraphBuilder` due to a Provenance Gate violation, logging the rejection with the node `title` and `sourceId` list.
5. THE `Orchestrator` SHALL add each `RelationshipEdge` produced by the `Reconciler` to the `GraphBuilder` via `addEdge`.
6. WHEN `GraphBuilder.build()` returns a `ValidationError`, THE `Orchestrator` SHALL log the full error list and return a partial graph containing only the nodes and edges that passed validation, rather than failing the entire pipeline run.
7. THE `Orchestrator` SHALL pass the assembled `ContentGraph` through `withProvenanceFilter` from the `provenance-gate` package before persisting it, and SHALL log every entry in the `removed` array.
8. THE `Orchestrator` SHALL persist the final `ContentGraph` to the database via Prisma and SHALL return the graph `id` to the client.
9. THE `Orchestrator` SHALL delete all source blobs from transient storage within 24 hours of pipeline completion (privacy default).
10. WHEN the `ContentGraph` contains at least one `"contradicts"` edge, THE `Orchestrator` SHALL include a `hasContradictions: true` flag in the pipeline result returned to the client.

---

### Requirement 7: End-to-End Performance

**User Story:** As a learner, I want the pipeline to complete within 90 seconds for a 30-page PDF and a 14-minute YouTube video, so that I can start exploring the graph without a disruptive wait.

#### Acceptance Criteria

1. THE `Pipeline` SHALL complete all five stages for a batch containing one 30-page text-based PDF and one 14-minute YouTube video with an available transcript in under 90 seconds on the target demo hardware.
2. THE `Pipeline` SHALL complete Stage 1 (Ingest) for a 30-page text-based PDF in under 20 seconds.
3. THE `Pipeline` SHALL complete Stage 1 (Ingest) for a 14-minute YouTube video using the `youtube-transcript` package in under 10 seconds.
4. THE `Pipeline` SHALL complete Stage 1 (Ingest) for a 14-minute YouTube video using the Whisper fallback in under 40 seconds.
5. THE `Orchestrator` SHALL execute Stage 2 (Extract) Claude calls for all sources in the batch concurrently, not sequentially, to minimize total latency.
6. WHEN the total pipeline duration exceeds 90 seconds, THE `Orchestrator` SHALL emit a structured warning log entry identifying which stage exceeded its time budget.

---

### Requirement 8: Ingestion Progress Streaming

**User Story:** As a learner with ADHD, I want to see real-time progress updates as each pipeline stage completes, so that I know the system is working and can estimate when the graph will be ready.

#### Acceptance Criteria

1. THE `Orchestrator` SHALL emit an `IngestionProgress` server-sent event at the start and completion of each pipeline stage, containing the stage name, status (`"started"` or `"completed"`), and elapsed time in milliseconds.
2. THE `Orchestrator` SHALL emit an `IngestionProgress` event when each individual source completes Stage 1 parsing, identifying the `sourceId` and `SourceType`.
3. THE `Orchestrator` SHALL emit a final `IngestionProgress` event when the `ContentGraph` is persisted, containing the graph `id`, total node count, total edge count, and contradiction count.
4. THE client SHALL render progress updates in an ARIA live region with `aria-live="polite"` so that screen readers announce stage completions without interrupting the learner's current focus.
5. THE client SHALL display a progress indicator that respects `prefers-reduced-motion` — WHEN `prefers-reduced-motion` is set to `reduce`, THE client SHALL display a static text status rather than an animated progress bar.
6. WHEN the pipeline fails at any stage, THE `Orchestrator` SHALL emit an `IngestionProgress` event with `status: "failed"`, the stage name, and a human-readable error message, and the client SHALL display the error without requiring a page reload.

---

### Requirement 9: Agency Guardrail Enforcement

**User Story:** As a developer responsible for the Agency Guardrail, I want the pipeline to enforce all applicable guardrail rules at runtime, so that the system never generates content not present in the source material and never processes graded assignments.

#### Acceptance Criteria

1. WHEN the `Orchestrator` receives a batch where any source has `GradedAssignmentFlag` set to `true`, THE `Orchestrator` SHALL reject the entire batch immediately with error code `"graded-assignment-refused"` and SHALL NOT forward any source to the `IngestService` (Agency Guardrail Rule 5).
2. THE `Orchestrator` SHALL include in every Claude extraction prompt an explicit instruction that the model MUST only extract claims present verbatim or by direct implication in the provided text, and MUST NOT generate, infer, or synthesize claims (Agency Guardrail Rule 2).
3. WHEN the `Reconciler` classifies a contradiction, THE `Reconciler` SHALL preserve both sides of the contradiction in the graph with their respective `EvidenceAnchor` entries and SHALL NOT select one source as the authoritative answer (Agency Guardrail Rule 2).
4. WHEN the `DomainClassification` of any source is `"medical"`, `"legal"`, or `"psychological"`, THE `Orchestrator` SHALL attach a `professionalVerificationRequired: true` flag to every `ConceptNode` extracted from that source (Agency Guardrail Rule 6).
5. THE `Orchestrator` SHALL enforce the Provenance Gate by discarding any `CandidateNode` with an empty `evidenceAnchors` array before it reaches the `GraphBuilder`, and SHALL log each discarded candidate with its `title` and `sourceId` (Agency Guardrail Rule 1).
6. THE `Pipeline` SHALL pass the assembled `ContentGraph` through `withProvenanceFilter` before persistence, ensuring no node without a valid `EvidenceAnchor` is ever written to the database (Agency Guardrail Rule 1).

---

### Requirement 10: Zod Schema Validation at Every Boundary

**User Story:** As a developer building the pipeline, I want Zod schemas at every input and output boundary between pipeline stages, so that type errors are caught at runtime before they propagate and corrupt the graph.

#### Acceptance Criteria

1. THE `Orchestrator` SHALL validate the raw client input (source files and metadata) against a `BatchIngestionInput` Zod schema before forwarding to the `IngestService`.
2. THE `IngestService` SHALL validate its HTTP response payload against a `NormalizedDocument` Pydantic schema before returning it to the `Orchestrator`.
3. THE `Orchestrator` SHALL validate the `NormalizedDocument` array received from the `IngestService` against a Zod schema before passing it to Stage 2.
4. THE `Orchestrator` SHALL validate every `CandidateNode` returned by Claude against `ConceptNode_Schema` before accepting it into the alignment stage.
5. THE `Orchestrator` SHALL validate every `RelationshipEdge` produced by the `Reconciler` against `RelationshipEdge_Schema` before passing it to the `GraphBuilder`.
6. THE `Orchestrator` SHALL validate the final `ContentGraph` returned by `GraphBuilder.build()` against `ContentGraph_Schema` before persisting it.
7. IF any Zod validation fails at a stage boundary, THEN THE `Orchestrator` SHALL log the full Zod error with the stage name and input shape, and SHALL surface a structured error to the client identifying which stage failed.

---

### Requirement 11: Property-Based Tests — Provenance Gate Cannot Be Bypassed

**User Story:** As a developer responsible for the Agency Guardrail, I want property-based tests that prove no `ConceptNode` without a valid `EvidenceAnchor` can survive the full pipeline and reach the persisted `ContentGraph`, so that the Provenance Gate invariant is machine-verified end-to-end.

#### Acceptance Criteria

1. THE `Pipeline_PBT` SHALL generate arbitrary `CandidateNode` arrays containing a mix of nodes with and without `evidenceAnchors` via fast-check and verify that `withProvenanceFilter` always returns a graph where every node has at least one `EvidenceAnchor`.
2. THE `Pipeline_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` instances produced by the pipeline, every `ConceptNode` in `graph.nodes` SHALL have `evidenceAnchors.length >= 1`.
3. THE `Pipeline_PBT` SHALL verify the invariant: FOR ALL `ContentGraph` instances produced by the pipeline, every `"contradicts"` `RelationshipEdge` in `graph.edges` SHALL have `evidenceAnchors` containing entries from at least two distinct `sourceId` values.
4. THE `Pipeline_PBT` SHALL verify the round-trip property: FOR ALL valid `NormalizedDocument` inputs, serializing to JSON and deserializing via the `NormalizedDocument` Zod schema SHALL produce a structurally equivalent document.
5. THE `Pipeline_PBT` SHALL verify the extraction idempotence property: FOR ALL `NormalizedDocument` inputs, running Stage 2 (Extract) twice on the same document SHALL produce `CandidateNode` arrays with the same titles and `evidenceAnchors` (modulo UUID generation).
6. THE `Pipeline_PBT` SHALL verify the alignment partition property: FOR ALL sets of `CandidateNode` entries, the `AlignmentGroup` entries produced by the `Aligner` SHALL form a partition — every candidate appears in exactly one group and no candidate is omitted.
7. WHEN the `Pipeline_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

---

### Requirement 12: Property-Based Tests — Contradiction Detection Correctness

**User Story:** As a developer building the contradiction detection feature, I want property-based tests that prove the Reconciler never emits a `"contradicts"` edge without evidence from two distinct sources, so that the contradiction claim is always backed by citations from both sides.

#### Acceptance Criteria

1. THE `Reconciler_PBT` SHALL generate arbitrary `AlignmentGroup` inputs where all candidates share the same `sourceId` via fast-check and verify that the `Reconciler` never emits a `"contradicts"` edge for any such group.
2. THE `Reconciler_PBT` SHALL generate arbitrary `AlignmentGroup` inputs containing candidates from exactly one source via fast-check and verify that the `Reconciler` never emits a `"contradicts"` edge for any such group.
3. THE `Reconciler_PBT` SHALL verify the invariant: FOR ALL `"contradicts"` edges in any `ContentGraph` produced by the pipeline, the `evidenceAnchors` array SHALL contain entries with at least two distinct `sourceId` values.
4. THE `Reconciler_PBT` SHALL verify the metamorphic property: FOR ALL `AlignmentGroup` inputs classified as `"contradict"`, swapping the order of the two contradicting candidates SHALL produce a `"contradicts"` edge with the same `evidenceAnchors` (order-independent).
5. WHEN the `Reconciler_PBT` suite is run via Vitest, THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.

---

### Requirement 13: Accessibility — Ingestion UI

**User Story:** As a learner with ADHD or dyslexia, I want the file upload and progress UI to be fully keyboard-navigable and screen-reader-friendly, so that I can submit sources and monitor pipeline progress without relying on a mouse or visual-only feedback.

#### Acceptance Criteria

1. THE `IngestionUI` SHALL provide a file upload control implemented as a `<input type="file">` with an associated `<label>`, accepting drag-and-drop as an enhancement but not as the only interaction path.
2. THE `IngestionUI` SHALL provide a text input for YouTube URLs with an associated `<label>` and a visible focus indicator meeting WCAG 2.2 Level AA (`focus-visible:ring-2 ring-offset-2`).
3. THE `IngestionUI` SHALL provide a checkbox labeled "This is a graded assignment" that, when checked, disables the submit button and displays a visible refusal message explaining why the pipeline will not process the material.
4. THE `IngestionUI` SHALL render pipeline progress updates in an ARIA live region (`aria-live="polite"`) so that screen readers announce stage completions without interrupting the learner's current focus.
5. WHEN `prefers-reduced-motion` is set to `reduce`, THE `IngestionUI` SHALL replace all animated progress indicators with static text status messages.
6. THE `IngestionUI` SHALL meet WCAG 2.2 Level AA contrast requirements: 4.5:1 for all text elements and 3:1 for all UI component boundaries.
7. THE `IngestionUI` SHALL ensure all interactive controls have a minimum click/tap target size of 44×44 px.
8. THE `IngestionUI` SHALL use `forwardRef` on every interactive component to support programmatic focus management.
9. WHEN a pipeline error occurs, THE `IngestionUI` SHALL display the error message in an ARIA live region with `role="alert"` and `aria-live="assertive"` so that screen readers announce the failure immediately.
