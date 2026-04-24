---
inclusion: always
---
# Tech Stack

## Frontend
- Next.js 14 (App Router), TypeScript strict mode
- Tailwind CSS + shadcn/ui components
- React Flow for the interactive canvas (NOT custom SVG)
- Lexend font via next/font for dyslexia mode
- Framer Motion for animations (respect prefers-reduced-motion)

## Backend
- Next.js API routes for orchestration and server actions
- Python FastAPI microservice (apps/ingest/) ONLY for PDF/video parsing
- Anthropic Claude Sonnet 4.5 for content graph generation
- OpenAI Whisper for audio/video transcription

## Data
- SQLite + Prisma for local dev (zero setup)
- Postgres via Supabase if we deploy
- Source materials deleted from storage within 24 hours (privacy default)
- Content graphs persisted; source blobs are transient

## Testing
- Vitest for unit tests
- fast-check for property-based tests on guardrails
- Playwright for E2E accessibility testing

## Conventions
- Server Actions over API routes for mutations where possible
- Zod schemas at every input boundary
- forwardRef on every interactive component for focus management
- tRPC is NOT used — keep the stack minimal
- No state management libraries beyond React's built-ins + useSyncExternalStore

## Package management
- pnpm workspaces (apps/ and packages/)
- Turborepo for task orchestration
- Node 20 LTS, Python 3.11