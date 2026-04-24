---
inclusion: always
---
# Product Overview

## Name
Lattice (working title — the multi-source content graph is the product)

## One-line description
Lattice turns raw learning materials (PDFs, images, videos, audio) into a
single interactive infographic, rendered in the format each learner's
ADHD or dyslexia profile needs.

## The problem we solve
College students with ADHD and/or dyslexia spend disproportionate time
converting standard course materials into formats they can engage with.
Existing AI study tools (NotebookLM, ChatGPT, Quizlet) do the learning
FOR the student, violating the agency principle. We do the opposite: we
remove format barriers so the student can do the learning themselves.

## Target users
1. College students with diagnosed ADHD
2. College students with diagnosed dyslexia
3. College students with both (high co-occurrence, ~30%)

## Non-goals (things we deliberately do NOT do)
- We are NOT a chatbot. No freeform Q&A about content.
- We do NOT generate factual content not present in the source material.
- We do NOT grade, score, or evaluate learner understanding.
- We do NOT replace tutors, professors, or disability services.
- We do NOT offer medical, legal, or diagnostic advice.

## The Agency Guardrail (Education frame)
The AI is scaffolding, never solution. Every feature must preserve the
learner's ownership of the cognitive work. If a feature would do the
learning for the student, it does not ship.

## Success criteria for the Kiro Spark demo
1. A learner pastes a PDF + a YouTube link and gets an interactive
   infographic in under 90 seconds.
2. The same content renders distinctly in ADHD mode vs dyslexia mode,
   switchable live.
3. Every concept node has a one-tap provenance jump back to its source.
4. Multi-source contradiction detection surfaces when two sources disagree.
5. A property-based test proves the Provenance Gate cannot be bypassed.

## What "done" looks like per prize signal
- Build: 8 specs shipped with EARS requirements, PBT on all guardrails.
- Collaboration: 4 path-scoped custom agents, 4 hooks, public git history
  showing spec iteration.
- Impact: Clear disability equity story, 2 real disabled student test
  sessions documented.
- Story: Public GitHub, auto-generated changelog, 12+ team social posts.