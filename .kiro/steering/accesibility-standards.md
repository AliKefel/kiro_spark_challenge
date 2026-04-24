---
inclusion: always
---
# Accessibility Standards (NON-NEGOTIABLE)

Every UI component MUST satisfy these before merge:

## Universal (applies to all modes)
1. WCAG 2.2 Level AA contrast: 4.5:1 for text, 3:1 for UI components
2. Full keyboard navigation. No interaction requires a mouse.
3. Visible focus indicator: focus-visible:ring-2 ring-offset-2
4. Semantic HTML before ARIA. <button> not <div onClick>.
5. ARIA live regions for dynamic content updates (aria-live="polite")
6. Respect prefers-reduced-motion for all animations
7. Support 200% browser zoom without horizontal scroll
8. All images: meaningful alt text OR alt="" for decorative
9. Form inputs always have associated <label>
10. Color is never the only signal (pair with icon or text)
11. Minimum click target 44x44 px
12. No timed interactions without pause/extend/dismiss controls

## ADHD mode additions
- Focus mode: dim non-active nodes to 20% opacity
- Body-double timer: optional, dismissible, never modal, no shame UI
- "Recap" button always visible — one tap summarizes last 3 interactions
- Working memory panel: pinned list of facts established this session
- No streak gamification, no urgency timers, no fire emoji
- Session resume: reopens to exact cursor position

## Dyslexia mode additions
- Font: Lexend (preferred) or OpenDyslexic via toggle
- Line-height >= 1.6
- Sentence-per-line layout option for prose blocks
- NEVER italics for emphasis — use bold or color
- Reading ruler overlay available (horizontal bar follows cursor)
- Synchronized text-to-speech with word-level highlighting
- Speech-to-text input available on every text field

## Layered profiles
A learner can have ADHD + dyslexia simultaneously. Both layers apply.
Profile state lives in a single JSON object the user owns and can export.

## Enforcement
If a generated component violates any rule above, refuse to ship it
and surface the conflict. Do not silently work around.