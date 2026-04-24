---
inclusion: always
---
# Agency Guardrail (HARD RULES)

This is an Education-frame hackathon submission. The AI is scaffolding,
never solution. These rules are enforced in code, not aspirations.

## Rule 1: Provenance Gate
Every ConceptNode MUST have at least one valid EvidenceAnchor
(sourceId + location) before it renders. The renderer MUST refuse to
display unanchored content. This is a runtime check, tested with PBT.

## Rule 2: No Authoritative Generation
The system extracts claims from source material. It does not invent
them. If sources are ambiguous, the infographic preserves the ambiguity
rather than resolving it. If sources contradict, we surface both sides
with citations — we do not pick a winner.

## Rule 3: Active Recall Gate
Flashcard answers cannot be revealed until the learner has submitted
a non-empty attempt (typed or spoken). No tap-to-reveal without prior input.

## Rule 4: No Evaluation
Any "Teach-it-back" or explanation feature transcribes the learner's words
and offers reflection prompts. It NEVER scores, grades, or corrects.

## Rule 5: No Graded Homework
The system refuses to operate on source material the learner flags as
"graded assignment." A checkbox at upload time triggers refusal.

## Rule 6: No Authoritative Domain Advice
If ingested content is classified as medical, legal, or psychological
advice, the gate adds a "verify with a professional" overlay and
disables simplification features for that content.

## Enforcement
When generating any code that would violate these rules, stop and
surface the conflict. Do not write the code. Each rule has a
corresponding EARS requirement in .kiro/specs/agency-logic-gate/
and property-based tests that run on every commit.