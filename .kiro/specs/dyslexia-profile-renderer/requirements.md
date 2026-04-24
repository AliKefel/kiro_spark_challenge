# Requirements Document

## Introduction

The Dyslexia Profile Renderer is a set of React components and typographic modifiers that transform the default Lattice reading experience for learners with dyslexia. It layers five independently toggleable components on top of the existing prose and flashcard surfaces: `FontToggle`, `SentencePerLine`, `ReadingRuler`, `SyncTextToSpeech`, and `SpeechToTextInput`. All components are governed by the Agency Guardrail — none of them do the learning for the student. All components meet WCAG 2.2 AA. Profile state is stored in a single exportable JSON object the learner owns.

When dyslexia mode is active, a set of global typographic overrides applies to all prose surfaces: minimum line-height of 1.6, no italics (italic source text is rendered as bold), generous paragraph spacing, and a maximum prose line length of 60ch. These overrides are scoped to the active dyslexia profile and do not affect the canvas when dyslexia mode is off. Typography tokens are overridable per-component so that individual components can refine the global defaults without breaking them.

The renderer is designed to layer cleanly with the ADHD Profile Renderer. When both profiles are active simultaneously, dyslexia-mode typography settings take precedence over any ADHD-mode defaults that would conflict.

---

## Glossary

- **DyslexiaProfile**: The single JSON object that holds the on/off state and configuration for every dyslexia-mode component. Owned by the learner and exportable.
- **DyslexiaProfileRenderer**: The top-level wrapper component that reads `DyslexiaProfile` and conditionally renders each sub-component and applies global typographic overrides.
- **FontToggle**: A component that switches prose rendering between the default system font, Lexend, and OpenDyslexic. The selected font is persisted to `DyslexiaProfile`.
- **FontOption**: One of three enumerated values: `"default"`, `"lexend"`, or `"opendyslexic"`. Stored in `DyslexiaProfile.fontOption`.
- **SentencePerLine**: A layout modifier that renders paragraph text as one sentence per line, with continuation lines indented by 1.5ch. Applies to expanded explanations and flashcard body text.
- **ReadingRuler**: A full-width horizontal overlay bar that tracks the pointer or scroll position, dimming text above and below the ruler line to reduce visual crowding. Toggleable by the learner.
- **RulerPosition**: The vertical pixel offset of the `ReadingRuler` bar from the top of the viewport, updated on pointer move and scroll events.
- **SyncTextToSpeech**: A component that reads the current paragraph aloud using the browser `SpeechSynthesis` API, with word-level highlighting synchronized to speech progress. Supports adjustable playback speed between 0.75× and 1.5×, pause/resume, and keyboard control.
- **SpeechSynthesisVoice**: A voice object returned by `window.speechSynthesis.getVoices()`. Classified as "quality" if its `localService` property is `true` or its name matches a known high-quality voice list; otherwise classified as "robotic".
- **WordHighlight**: The visual state applied to the word currently being spoken by `SyncTextToSpeech`, implemented via a `<mark>` element or equivalent inline wrapper.
- **SpeechToTextInput**: A variant of every text input that accepts voice input via the browser `Web Speech API` (`SpeechRecognition`). Renders a microphone button inline with the input field; the live transcript appears in the field as the learner speaks.
- **TranscriptState**: The current partial or final transcript string produced by `SpeechRecognition` and displayed in the `SpeechToTextInput` field.
- **GlobalDyslexiaOverrides**: The set of CSS custom properties and Tailwind utility classes applied to all prose surfaces when `DyslexiaProfile.dyslexiaModeEnabled` is `true`: `line-height >= 1.6`, no italics (italic source rendered as bold), `paragraph-spacing >= 1em`, `max-width: 60ch` on prose blocks.
- **ProseBlock**: Any rendered block of body text in Lattice, including `ConceptNode` expanded explanations, flashcard body text, and source excerpt panels.
- **FlashcardBody**: The text content area of a flashcard component, as defined in the interactive-canvas spec.
- **TypographyToken**: A CSS custom property (e.g., `--lattice-line-height`, `--lattice-font-family`) that controls a single typographic dimension. Overridable per-component via a `typographyOverrides` prop.
- **prefers-reduced-motion**: The CSS media feature and corresponding React hook used to disable or replace animations for learners who have requested reduced motion.
- **WCAG 2.2 AA**: The accessibility conformance level required for all components in this spec.
- **Web Speech API**: The browser-native API comprising `SpeechSynthesis` (text-to-speech) and `SpeechRecognition` (speech-to-text), available in modern browsers without additional dependencies.

---

## Requirements

### Requirement 1: DyslexiaProfile State Object

**User Story:** As a learner with dyslexia, I want my dyslexia-mode preferences stored in a single JSON object that I own and can export, so that my configuration is portable and not locked into the application.

#### Acceptance Criteria

1. THE `DyslexiaProfileRenderer` SHALL read component visibility, configuration, and the active `FontOption` from a single `DyslexiaProfile` JSON object passed as a prop.
2. THE `DyslexiaProfile` SHALL contain the following fields: `dyslexiaModeEnabled` (boolean), `fontOption` (`"default"` | `"lexend"` | `"opendyslexic"`), `sentencePerLineEnabled` (boolean), `readingRulerEnabled` (boolean), `syncTextToSpeechEnabled` (boolean), `speechToTextEnabled` (boolean), and `ttsSpeed` (number, range 0.75–1.5).
3. THE `DyslexiaProfileRenderer` SHALL expose an `onProfileChange` callback that emits the updated `DyslexiaProfile` object whenever any field changes, so that the parent can persist the new state.
4. THE `DyslexiaProfile` object SHALL be serialisable to and from JSON without data loss.
5. THE `DyslexiaProfileRenderer` SHALL render each sub-component independently based on its corresponding `DyslexiaProfile` field; disabling one component SHALL NOT affect the rendering of any other component.
6. FOR ALL valid `DyslexiaProfile` inputs, serialising the profile to JSON and deserialising it SHALL produce an object that is deeply equal to the original (round-trip property).

---

### Requirement 2: GlobalDyslexiaOverrides — Typographic Baseline

**User Story:** As a learner with dyslexia, I want all prose in the app to automatically apply dyslexia-friendly typography when my profile is active, so that I do not have to configure each surface individually.

#### Acceptance Criteria

1. WHEN `dyslexiaModeEnabled` is `true` in `DyslexiaProfile`, THE `DyslexiaProfileRenderer` SHALL apply `GlobalDyslexiaOverrides` to all `ProseBlock` elements within its subtree.
2. THE `GlobalDyslexiaOverrides` SHALL set a minimum `line-height` of `1.6` on all `ProseBlock` elements.
3. THE `GlobalDyslexiaOverrides` SHALL set a maximum inline size of `60ch` on all `ProseBlock` elements.
4. THE `GlobalDyslexiaOverrides` SHALL set a minimum `paragraph-spacing` (margin-bottom on `<p>` elements) of `1em` on all `ProseBlock` elements.
5. WHEN `dyslexiaModeEnabled` is `true`, THE `DyslexiaProfileRenderer` SHALL render any source text marked as italic as bold instead, and SHALL NOT render any italic text within `ProseBlock` elements.
6. WHEN `dyslexiaModeEnabled` is `false`, THE `DyslexiaProfileRenderer` SHALL remove all `GlobalDyslexiaOverrides` and restore the default typographic styles.
7. THE `GlobalDyslexiaOverrides` SHALL be implemented via `TypographyToken` CSS custom properties so that individual components can override specific tokens without disabling the full override set.
8. WHEN both dyslexia mode and ADHD mode are active simultaneously, THE `DyslexiaProfileRenderer` SHALL apply `GlobalDyslexiaOverrides` without being overridden by ADHD-mode typographic defaults.

---

### Requirement 3: FontToggle — Dyslexia-Friendly Font Selection

**User Story:** As a learner with dyslexia, I want to switch between the default font, Lexend, and OpenDyslexic, so that I can use the typeface that reduces my reading friction most effectively.

#### Acceptance Criteria

1. WHEN `dyslexiaModeEnabled` is `true` in `DyslexiaProfile`, THE `FontToggle` SHALL be rendered as a visible control in the dyslexia settings panel.
2. THE `FontToggle` SHALL present exactly three options: `"Default"`, `"Lexend"`, and `"OpenDyslexic"`, corresponding to the three `FontOption` values.
3. WHEN the learner selects a `FontOption`, THE `FontToggle` SHALL update `DyslexiaProfile.fontOption` and emit the updated profile via `onProfileChange`.
4. WHEN `DyslexiaProfile.fontOption` is `"lexend"`, THE `DyslexiaProfileRenderer` SHALL apply the Lexend typeface (loaded via `next/font`) to all `ProseBlock` elements.
5. WHEN `DyslexiaProfile.fontOption` is `"opendyslexic"`, THE `DyslexiaProfileRenderer` SHALL apply the OpenDyslexic typeface to all `ProseBlock` elements.
6. WHEN `DyslexiaProfile.fontOption` is `"default"`, THE `DyslexiaProfileRenderer` SHALL apply the system default typeface to all `ProseBlock` elements.
7. THE `FontToggle` control SHALL reflect the currently active `FontOption` via a visually distinct selected state that does not rely on color alone.
8. THE `FontToggle` control SHALL be fully keyboard-navigable; each option SHALL be reachable and selectable via keyboard alone.
9. THE `FontToggle` control SHALL use `role="radiogroup"` with each option as `role="radio"` and `aria-checked` reflecting the selected state.
10. THE `FontToggle` control SHALL meet the 44×44px minimum tap target size per option and WCAG 2.2 AA contrast requirements.

---

### Requirement 4: SentencePerLine — One Sentence Per Line Layout

**User Story:** As a learner with dyslexia, I want paragraphs rendered as one sentence per line, so that I can track my reading position without losing my place in dense text.

#### Acceptance Criteria

1. WHEN `sentencePerLineEnabled` is `true` in `DyslexiaProfile`, THE `SentencePerLine` modifier SHALL split each `ProseBlock` paragraph into individual sentence segments and render each sentence on its own line.
2. THE `SentencePerLine` modifier SHALL apply to all `ProseBlock` elements and `FlashcardBody` elements within the `DyslexiaProfileRenderer` subtree.
3. WHEN a sentence wraps to a second visual line due to the `60ch` max-width constraint, THE `SentencePerLine` modifier SHALL indent the continuation line by `1.5ch` relative to the sentence start.
4. THE `SentencePerLine` modifier SHALL preserve the original sentence text content exactly; no words, punctuation, or whitespace SHALL be added, removed, or reordered.
5. WHEN `sentencePerLineEnabled` is toggled from `true` to `false`, THE `SentencePerLine` modifier SHALL restore the original paragraph layout without a page reload.
6. THE `SentencePerLine` modifier SHALL NOT alter the semantic HTML structure of the content in a way that changes the reading order for screen reader users.
7. THE `SentencePerLine` modifier SHALL use sentence boundary detection based on terminal punctuation (`.`, `!`, `?`) followed by whitespace and an uppercase letter, or end of string; it SHALL NOT rely on an external NLP library.
8. FOR ALL `ProseBlock` inputs, the concatenated text content of all sentence segments produced by `SentencePerLine` SHALL equal the original paragraph text content after normalising whitespace (round-trip property).

---

### Requirement 5: ReadingRuler — Cursor-Tracking Overlay Bar

**User Story:** As a learner with dyslexia, I want a horizontal reading ruler that follows my cursor or scroll position, so that I can isolate the line I am reading and reduce visual crowding from surrounding text.

#### Acceptance Criteria

1. WHEN `readingRulerEnabled` is `true` in `DyslexiaProfile`, THE `ReadingRuler` SHALL render a full-viewport-width horizontal bar overlaid on the page content.
2. THE `ReadingRuler` bar SHALL track the vertical position of the pointer; WHEN the pointer moves, THE `ReadingRuler` SHALL update `RulerPosition` to align the bar's vertical centre with the pointer's `clientY` coordinate.
3. WHEN the learner scrolls without moving the pointer, THE `ReadingRuler` SHALL maintain the bar at the last known pointer `clientY` position relative to the viewport.
4. THE `ReadingRuler` SHALL dim all text above and below the ruler bar to 40% opacity, leaving text within the ruler bar at 100% opacity.
5. THE `ReadingRuler` bar height SHALL be exactly one line-height unit (matching the current `--lattice-line-height` token value) so that it frames a single line of text.
6. THE `ReadingRuler` overlay SHALL use `pointer-events: none` so that it does not intercept clicks, selections, or other pointer interactions with the underlying content.
7. THE `ReadingRuler` SHALL be toggleable via a keyboard shortcut (`Alt+R`) in addition to the settings panel toggle, and the current state SHALL be announced to screen readers via an `aria-live="polite"` region.
8. WHEN `prefers-reduced-motion` is set to `reduce`, THE `ReadingRuler` SHALL update `RulerPosition` immediately without a CSS transition on the bar's vertical position.
9. WHEN `prefers-reduced-motion` is not set to `reduce`, THE `ReadingRuler` SHALL apply a CSS transition of no more than 80ms on the bar's vertical position to smooth rapid pointer movement.
10. THE `ReadingRuler` SHALL NOT alter the `aria-hidden` state or DOM order of any content element; all content SHALL remain reachable by keyboard and screen reader navigation.

---

### Requirement 6: SyncTextToSpeech — Word-Level Highlighted Playback

**User Story:** As a learner with dyslexia, I want the current paragraph read aloud with each word highlighted as it is spoken, so that I can follow along without losing my place in the text.

#### Acceptance Criteria

1. WHEN `syncTextToSpeechEnabled` is `true` in `DyslexiaProfile`, THE `SyncTextToSpeech` component SHALL render a play/pause button adjacent to each `ProseBlock` paragraph and each `FlashcardBody`.
2. WHEN the learner activates the play button (click, tap, or `Enter`/`Space` key), THE `SyncTextToSpeech` component SHALL begin reading the associated text using `window.speechSynthesis` and SHALL apply a `WordHighlight` to each word as it is spoken.
3. THE `SyncTextToSpeech` component SHALL use the `SpeechSynthesisUtterance.onboundary` event to synchronise `WordHighlight` position with the current spoken word.
4. THE `SyncTextToSpeech` component SHALL support playback speeds of `0.75×`, `1.0×`, `1.25×`, and `1.5×`, selectable via a speed control rendered alongside the play/pause button.
5. WHEN the learner changes the playback speed during active playback, THE `SyncTextToSpeech` component SHALL apply the new speed to the current utterance without restarting from the beginning of the paragraph.
6. THE `SyncTextToSpeech` component SHALL persist the selected playback speed to `DyslexiaProfile.ttsSpeed` via `onProfileChange`.
7. WHEN `window.speechSynthesis.getVoices()` returns no `SpeechSynthesisVoice` classified as "quality", THE `SyncTextToSpeech` component SHALL display a non-blocking warning banner stating that only lower-quality voices are available on this device, and SHALL still allow playback to proceed.
8. WHEN the learner activates the pause button during playback, THE `SyncTextToSpeech` component SHALL pause speech and retain the `WordHighlight` on the last spoken word until playback resumes or is stopped.
9. WHEN the learner presses `Space` while a `SyncTextToSpeech` play button has focus, THE `SyncTextToSpeech` component SHALL toggle between play and pause states.
10. WHEN the learner presses `Escape` during active playback, THE `SyncTextToSpeech` component SHALL stop playback and remove all `WordHighlight` states.
11. THE `SyncTextToSpeech` play/pause button SHALL have an `aria-label` that reflects the current state: `"Play paragraph"` when stopped, `"Pause"` when playing, `"Resume"` when paused.
12. THE `WordHighlight` SHALL be implemented using a `<mark>` element or an element with `role="mark"` so that screen readers can identify the highlighted word.
13. THE `SyncTextToSpeech` play/pause button and speed control SHALL meet the 44×44px minimum tap target size and WCAG 2.2 AA contrast requirements.
14. WHEN `prefers-reduced-motion` is set to `reduce`, THE `SyncTextToSpeech` component SHALL apply `WordHighlight` without CSS transition animations on the highlight position.

---

### Requirement 7: SpeechToTextInput — Voice Input on Every Text Field

**User Story:** As a learner with dyslexia, I want to dictate text into any input field using my voice, so that I can contribute written responses without the barrier of typing.

#### Acceptance Criteria

1. WHEN `speechToTextEnabled` is `true` in `DyslexiaProfile`, THE `SpeechToTextInput` component SHALL render a microphone button inline with every text input and textarea in the `DyslexiaProfileRenderer` subtree.
2. WHEN the learner activates the microphone button (click, tap, or `Enter`/`Space` key), THE `SpeechToTextInput` component SHALL start a `SpeechRecognition` session with `continuous` set to `false` and `interimResults` set to `true`.
3. WHILE a `SpeechRecognition` session is active, THE `SpeechToTextInput` component SHALL display the current `TranscriptState` (interim and final results) in the associated input field in real time.
4. WHEN the `SpeechRecognition` session produces a final result, THE `SpeechToTextInput` component SHALL append the final transcript to any existing text in the input field, separated by a single space if the field is non-empty.
5. WHEN the learner activates the microphone button a second time during an active session, THE `SpeechToTextInput` component SHALL stop the `SpeechRecognition` session and retain the current `TranscriptState` in the field.
6. IF the browser does not support `SpeechRecognition` (i.e., `window.SpeechRecognition` and `window.webkitSpeechRecognition` are both undefined), THEN THE `SpeechToTextInput` component SHALL hide the microphone button and SHALL NOT render any error state visible to the learner.
7. IF the `SpeechRecognition` session returns an error event with `error` equal to `"not-allowed"`, THEN THE `SpeechToTextInput` component SHALL display a non-blocking inline message stating that microphone permission is required, and SHALL stop the session.
8. THE microphone button SHALL have an `aria-label` of `"Start voice input"` when inactive and `"Stop voice input"` when a session is active, and SHALL have `aria-pressed` reflecting the active/inactive state.
9. THE microphone button SHALL meet the 44×44px minimum tap target size and WCAG 2.2 AA contrast requirements.
10. WHILE a `SpeechRecognition` session is active, THE `SpeechToTextInput` component SHALL render a visible recording indicator (distinct from color alone) adjacent to the microphone button.
11. THE `SpeechToTextInput` component SHALL NOT submit the associated form automatically upon receiving a final transcript; form submission SHALL remain under the learner's explicit control.
12. THE associated text input SHALL retain its existing `<label>` association; THE `SpeechToTextInput` component SHALL NOT remove or replace the input's `id`, `name`, or `aria-label` attributes.

---

### Requirement 8: Independent Toggling and Profile Composition

**User Story:** As a learner with dyslexia, I want to turn each dyslexia-mode component on or off independently, so that I can build the exact combination of supports that works for my specific needs.

#### Acceptance Criteria

1. THE `DyslexiaProfileRenderer` SHALL render each of the five components (`FontToggle`, `SentencePerLine`, `ReadingRuler`, `SyncTextToSpeech`, `SpeechToTextInput`) independently based solely on its corresponding `DyslexiaProfile` field.
2. WHEN any single `DyslexiaProfile` field is toggled, THE `DyslexiaProfileRenderer` SHALL re-render only the affected component and SHALL NOT unmount or reset the state of any other component.
3. THE `DyslexiaProfileRenderer` SHALL support simultaneous activation of all five components without layout conflicts or z-index collisions.
4. WHEN the learner's profile has both dyslexia mode and ADHD mode enabled, THE `DyslexiaProfileRenderer` SHALL apply dyslexia-mode typography settings (selected font, `line-height >= 1.6`, no italics) without being overridden by ADHD-mode defaults.
5. THE `DyslexiaProfileRenderer` SHALL expose a single `onProfileChange` callback; WHEN any component updates its own state, THE `DyslexiaProfileRenderer` SHALL emit the complete updated `DyslexiaProfile` object via `onProfileChange`.
6. FOR ALL combinations of boolean values in `DyslexiaProfile` (all 32 combinations of the five boolean fields), THE `DyslexiaProfileRenderer` SHALL render without throwing a runtime error (invariant over all toggle combinations).

---

### Requirement 9: Accessibility — All Dyslexia Components

**User Story:** As a learner with dyslexia who uses assistive technology, I want every dyslexia-mode component to be fully keyboard-navigable and screen-reader-compatible, so that the accessibility supports do not themselves create accessibility barriers.

#### Acceptance Criteria

1. THE `FontToggle` control, `ReadingRuler` toggle, `SyncTextToSpeech` play/pause and speed controls, and `SpeechToTextInput` microphone button SHALL each be reachable and operable by keyboard alone.
2. THE `SentencePerLine` modifier SHALL preserve the logical reading order of all sentence segments so that screen reader users encounter sentences in the same order as sighted users.
3. WHEN `ReadingRuler` dims surrounding text to 40% opacity, THE `ReadingRuler` SHALL NOT set `aria-hidden="true"` on any dimmed content; all content SHALL remain in the accessibility tree.
4. THE `SyncTextToSpeech` `WordHighlight` element SHALL be announced to screen readers as the currently spoken word via `aria-current="true"` or an equivalent live region, without interrupting the screen reader's own speech output.
5. ALL interactive elements across all five components SHALL have visible focus indicators meeting WCAG 2.2 AA: `focus-visible:ring-2 ring-offset-2`.
6. ALL text within all five components SHALL meet WCAG 2.2 AA contrast: 4.5:1 for body text and 3:1 for UI component borders.
7. THE `SpeechToTextInput` recording indicator SHALL convey its active state via both a visual shape change and an `aria-live="polite"` announcement, not by color alone.
8. THE `DyslexiaProfileRenderer` SHALL support 200% browser zoom on all five components without any text being clipped or requiring horizontal scrolling.
9. THE `SyncTextToSpeech` speed control SHALL be implemented as a `<select>` or `role="listbox"` element with a visible `<label>` or `aria-label` of `"Playback speed"`.
10. WHEN `dyslexiaModeEnabled` is toggled, THE `DyslexiaProfileRenderer` SHALL announce the new mode state to screen readers via an `aria-live="polite"` region (e.g., `"Dyslexia mode on"` / `"Dyslexia mode off"`).

---

### Requirement 10: Property-Based Tests — DyslexiaProfile Invariants

**User Story:** As a developer building the dyslexia renderer, I want property-based tests that verify the core invariants of the profile state machine and component rendering, so that edge cases in toggle combinations, text transformation, and speech API integration are machine-verified.

#### Acceptance Criteria

1. THE `DyslexiaProfile_PBT` SHALL generate arbitrary `DyslexiaProfile` objects (all 32 boolean combinations, with `ttsSpeed` sampled from `[0.75, 1.0, 1.25, 1.5]`) via fast-check and verify that `DyslexiaProfileRenderer` renders without throwing a runtime error for every combination.
2. THE `DyslexiaProfile_PBT` SHALL verify the round-trip property: FOR ALL valid `DyslexiaProfile` objects, serialising to JSON and deserialising SHALL produce an object deeply equal to the original.
3. THE `SentencePerLine_PBT` SHALL generate arbitrary `ProseBlock` text strings (length 1–2000 characters, including punctuation, numbers, and Unicode) via fast-check and verify the round-trip property: the concatenated text of all sentence segments produced by `SentencePerLine` SHALL equal the original text after normalising whitespace.
4. THE `SentencePerLine_PBT` SHALL verify the idempotence property: applying the `SentencePerLine` sentence-splitting function twice to the same input SHALL produce the same segment array as applying it once.
5. THE `FontToggle_PBT` SHALL generate arbitrary sequences of `FontOption` selections via fast-check and verify the invariant: after any sequence of selections, `DyslexiaProfile.fontOption` SHALL equal the last selected `FontOption` value.
6. THE `SyncTextToSpeech_PBT` SHALL generate arbitrary paragraph strings and verify the invariant: the array of word tokens produced by the TTS word-boundary splitter SHALL have a `join(" ")` result equal to the original paragraph string after normalising whitespace.
7. THE `DyslexiaProfile_PBT` suite SHALL be run via Vitest, and THE test runner SHALL report all property violations with a minimal failing example produced by fast-check's shrinking algorithm.
