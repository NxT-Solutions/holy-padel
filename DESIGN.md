---
version: alpha
name: Holy Padel — Court Bold
description: >-
  The persistent design system for Holy Padel: an athletic, high-contrast
  score-tracker. Anton condensed numerals + Archivo UI, ball-lime on near-black
  ink over warm cream. One palette, hand-mirrored across phone (Tamagui),
  Apple Watch (SwiftUI), and Wear OS (Compose). Canonical values live in
  apps/mobile/src/theme/colors.ts and tamagui.config.ts — this file is their
  human- and machine-readable contract.
colors:
  # Ink ramp — near-black surfaces & default text on light. Shared anchor: ink.
  ink: "#0E1116"          # primary text/ink; dark cards, tab bar, avatars
  ink-deep: "#0B0D11"     # darkest screen bg (match-won, live-dark)
  ink-card: "#12161C"     # dark surface card (phone)
  ink-raised: "#151922"   # raised dark tile (won-screen stats)
  ink-chip: "#1B2027"     # dark chip on a dark surface
  ink-button: "#181D24"   # dark secondary button
  # Accent — the ball. Shared anchor: lime.
  lime: "#C6F135"         # live/serve, primary CTA, wins, active accents
  lime-ink: "#7F9A12"     # lime that stays legible on white (active-set label)
  # Light surfaces (phone only).
  cream: "#F1F0EA"        # default light screen background
  sheet: "#F7F6F1"        # bottom-sheet / modal background
  input: "#ECEBE3"        # search / text-input background
  row: "#F4F3EE"          # player-row background in setup cards
  toggle: "#EFEEE7"       # segmented-control track
  # Neutrals & semantics.
  greige: "#E4E2D9"       # muted chip: losses, empty bars, the L badge
  white: "#FFFFFF"        # white cards; light text on ink. Shared anchor.
  team-blue: "#2E5BFF"    # Team B identity (avatar disc + letter)
  danger: "#C43F3F"       # destructive actions (delete, discard)
  # Text-opacity helpers are functions of alpha, not fixed tokens — see Colors
  # prose. Canonical rgba: inkAlpha=rgb(14,17,22), whiteAlpha=rgb(255,255,255),
  # limeAlpha=rgb(198,241,53).
typography:
  # Anton (condensed display). Weight 400 only. NEVER set a tight lineHeight —
  # round glyphs (0/O/Q) overshoot the baseline and clip ("0" reads "U").
  # lineHeight is intentionally omitted (natural metrics) on every Anton level.
  display-hero:  { fontFamily: Anton, fontSize: 112px, fontWeight: 400, letterSpacing: 0.5px }
  display-xl:    { fontFamily: Anton, fontSize: 76px,  fontWeight: 400, letterSpacing: 0.5px }
  display-lg:    { fontFamily: Anton, fontSize: 58px,  fontWeight: 400, letterSpacing: 1px }
  display-md:    { fontFamily: Anton, fontSize: 40px,  fontWeight: 400, letterSpacing: 0.5px }
  display-sm:    { fontFamily: Anton, fontSize: 34px,  fontWeight: 400, letterSpacing: 0.5px }
  heading:       { fontFamily: Anton, fontSize: 30px,  fontWeight: 400, letterSpacing: 0.5px }
  heading-sm:    { fontFamily: Anton, fontSize: 21px,  fontWeight: 400, letterSpacing: 0.5px }
  numeral-chip:  { fontFamily: Anton, fontSize: 20px,  fontWeight: 400, letterSpacing: 0.5px }
  # Archivo (UI text). Body prose ~1.45 leading; caps labels ~1.0.
  body-lg: { fontFamily: Archivo, fontSize: 16px,   fontWeight: 600, lineHeight: 1.45 }
  body-md: { fontFamily: Archivo, fontSize: 14px,   fontWeight: 600, lineHeight: 1.45 }
  body-sm: { fontFamily: Archivo, fontSize: 12.5px, fontWeight: 600, lineHeight: 1.45 }
  body-xs: { fontFamily: Archivo, fontSize: 11px,   fontWeight: 600, lineHeight: 1.4 }
  label:   { fontFamily: Archivo, fontSize: 13px,   fontWeight: 700, letterSpacing: 1.2px }
  overline: { fontFamily: Archivo, fontSize: 10px,  fontWeight: 800, letterSpacing: 1.5px, lineHeight: 1 }
rounded:
  sm: 8px      # small chips
  md: 14px     # tiles, set chips
  lg: 18px     # the Card default
  xl: 22px     # large cards (team cards, tap-to-score)
  sheet: 28px  # bottom-sheet top corners (28px 28px 0 0)
  full: 9999px # pills, tab bar, status pills (circles use 50%: avatars, dots)
spacing:
  # Exact-pixel fidelity is intentional (no forced token snapping) — these are
  # the de-facto rhythm, not a hard constraint.
  xs: 4px
  sm: 8px
  md: 10px
  lg: 16px
  xl: 20px
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.lg}"
    padding: 18px
  button-primary-pressed:
    backgroundColor: "{colors.lime}"   # press = opacity 0.85, not a hue change
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 16px
  button-danger:
    backgroundColor: "{colors.white}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  card-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
  overline:
    textColor: "{colors.ink}"          # applied at ~40% opacity (inkAlpha 0.4)
    typography: "{typography.overline}"
  avatar-team-a:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.lime}"
    rounded: "{rounded.full}"
  avatar-team-b:
    backgroundColor: "{colors.team-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
  result-badge-won:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  result-badge-lost:
    backgroundColor: "{colors.greige}"
    textColor: "{colors.ink}"          # at ~55% opacity
    rounded: "{rounded.sm}"
  live-dot:
    backgroundColor: "{colors.lime}"
    rounded: "{rounded.full}"
---

# Holy Padel — Court Bold Design System

## Overview

Holy Padel is a **local-first padel score tracker** with an athletic, confident
personality we call **"Court Bold."** The look is lifted verbatim from the
source design file (`design/Padel Score Tracker.dc.html`) and codified in
`apps/mobile/src/theme/colors.ts` — this document is the durable contract so the
system stays consistent as the app grows and across every platform.

The feeling is a scoreboard at a floodlit court at dusk: **near-black ink and a
single electric ball-lime accent over a warm, papery cream.** Condensed Anton
numerals hit like stencilled court signage; Archivo keeps the UI clean and
legible. It should read **fast, punchy, and sporty** — never corporate, never
pastel. Everything is tuned to be glanceable at arm's length, whether that's a
phone on the bench or a watch mid-rally.

Audience: padel players logging matches themselves, offline, on phone **and**
wearable. Priorities, in order: **legibility at a glance → high contrast →
playful energy**. When no specific token applies, favor the boldest legible
choice.

## Colors

The palette is high-contrast neutrals with one evocative accent. Three anchors
(**ink `#0E1116`**, **lime `#C6F135`**, **white `#FFFFFF`**) are identical on
all three platforms; everything else is platform-scoped.

- **Ink (`#0E1116`)** — the primary near-black. All default text on light
  surfaces, plus dark cards, the tab bar, and avatar discs. A small darker
  ramp deepens dark screens: `ink-deep` (match-won / live-dark background),
  `ink-card`, `ink-raised`, `ink-chip`, `ink-button`.
- **Lime (`#C6F135`)** — "the ball." The **signal** color, reserved for
  live/serving indication, the single primary CTA per screen, wins (the W
  badge), and active accents. `lime-ink` (`#7F9A12`) is the only lime that
  stays legible as text on white (the active-set label).
- **Cream (`#F1F0EA`)** — the default light background; warmer and more organic
  than pure white. Companion light surfaces: `sheet`, `input`, `row`, `toggle`.
- **Greige (`#E4E2D9`)** — the muted neutral for losses, empty progress bars,
  and the L badge.
- **Team blue (`#2E5BFF`)** — Team B's identity (avatar disc + letter). Team A
  is lime-on-ink.
- **Danger (`#C43F3F`)** — destructive actions only (delete match, discard).

**Opacity helpers, not new colors.** Muted text and hairlines are the anchors at
reduced opacity via three helpers in `colors.ts` — `inkAlpha(a)`
(`rgba(14,17,22,a)`), `whiteAlpha(a)` (`rgba(255,255,255,a)`), and `limeAlpha(a)`
(`rgba(198,241,53,a)`). Common values: `inkAlpha(0.45)` (muted body), `0.4`
(overline), `0.16` (hairline borders), `0.05` (card shadow); `whiteAlpha(0.5)`
(muted text on dark); `limeAlpha(0.3)` (serve-dot glow). Never hard-code a new
tint — reach for a helper so the palette stays the single source of truth.

## Typography

Two families, loaded in `apps/mobile/src/app/_layout.tsx` via `@expo-google-fonts`:

- **Anton** (`$heading`) — a single-weight condensed display face for **numerals,
  scores, headings, and team names**. Set once in `tamagui.config.ts` with
  `letterSpacing 0.5`.
- **Archivo** (`$body`) — the UI face (weights 400–800) for everything else.

The size ramp lives in `tamagui.config.ts` (`HEADING_SIZES` / `BODY_SIZES`); the
tokens above name the levels actually in use. The giant match numerals live at
`display-hero`/`display-xl` (112/76px); screen titles at `display-sm` (34px);
section eyebrows are the `overline` (10px / 800 / 1.5 tracking / uppercase).

> **The Anton clipping rule (load-bearing).** Never set a tight `lineHeight` on
> Anton/Display text — anything at or below `fontSize`. Anton's round glyphs
> (`0`, `O`, `Q`) overshoot below the baseline; without the font's natural
> descent room the bottom clips and **`0` reads as `U`**. Leave `lineHeight`
> unset (natural metrics) unless it is clearly ≥ ~1.3× `fontSize`. This is why
> every Anton token above omits `lineHeight`.

## Layout

**Light-first.** `TamaguiProvider` defaults to the light theme, the status bar is
dark, and the screen background is `cream`. Dark surfaces (the ink ramp) are used
deliberately for cards, the tab bar, avatars, and the match-won / live-dark
screens.

There is **no formal grid** — screens use safe-area insets
(`useSafeAreaInsets`) plus direct pixel padding and gaps (horizontal padding
16–20, gaps commonly 8–10). Exact-pixel fidelity is intentional:
`tamagui.config.ts` sets `onlyAllowShorthands: false` and
`allowedStyleValues: false` so screens can use the design's precise pixel values
and rgba colors without forced token snapping. The recurring long-form pattern is
a fixed header + scrollable body + **fixed footer CTA** (never let the primary
action scroll off-screen).

## Elevation & Depth

The system is **mostly flat**; depth comes from color contrast (ink on cream)
and a restrained shadow set, not heavy elevation:

- **Card:** `0 2px 10px rgba(14,17,22,0.05)` — the standard soft lift on white.
- **Lifted CTA:** `0 6px 18px rgba(198,241,53,0.45)` — a lime glow under the
  primary action.
- **Serve-dot glow:** a `limeAlpha(0.3)` ring marking the serving pair.
- **Bottom sheet:** `0 -12px 40px rgba(14,17,22,0.25)` lift; deeper modals
  `0 18px 40px rgba(14,17,22,0.35)`.

On dark screens, hierarchy is conveyed by stepping through the ink ramp
(`ink-deep` → `ink` → `ink-raised` → `ink-chip`) rather than by shadow.

## Shapes

Generous, friendly rounding throughout. Pills and status chips are fully round
(`rounded.full`); cards sit at `rounded.lg`–`xl` (18–22); tiles and set chips at
`rounded.md` (14); small chips at `rounded.sm` (8). Avatars and live/serve dots
are perfect circles (radius = size / 2). Bottom sheets round only their top
corners (`rounded.sheet`, 28px). Don't mix sharp and round corners in one view.

## Components

- **Primary button** — lime fill, ink label in Anton, `rounded.lg`, a lime glow
  shadow; press = opacity 0.85. Exactly **one** per screen (the signal rule).
- **Secondary / secondary-dark button** — white (or `ink-button`) fill, hairline
  border, `rounded.md`.
- **Danger button** — white fill, `danger` text + border; used for delete /
  discard, always behind a confirm.
- **Card** — white, `rounded.lg`, soft card shadow. `card-dark` inverts to ink
  with white text (`rounded.xl`) for hero/stat surfaces.
- **Pill** — fully-round row container; the ink **status pill** carries a live
  dot + white caps label.
- **Overline** — the tiny caps section eyebrow: `overline` type at ~40% ink.
- **Avatar** — round monogram. Team A = ink disc + lime letter; Team B =
  `team-blue` disc + white letter. Letter is Anton at 0.4× diameter.
- **Result badge** — W = lime fill + ink glyph; L = greige fill + 55% ink glyph
  (`rounded.sm`).
- **Live dot** — small lime circle marking live state and the serving pair.
- **Modal header** — an inset round icon button (‹ back or ✕ close) beside the
  title; every slide-out uses it so the exit is always in the same place.

Watch equivalents (`ResultBadge`, `Dot`, `DisplayText`/`LabelText`/`BodyText`)
reimplement these atoms with the mirrored palette — see Platforms below.

## Do's and Don'ts

- **Do** reserve lime for signal only — live/serving, the single primary CTA,
  wins, and active accents. **Don't** use lime as a neutral surface or for body
  text on white (use `lime-ink` if you must).
- **Don't** ever set a tight `lineHeight` on Anton/Display text — it clips
  round glyphs. Leave it unset unless ≥ ~1.3× `fontSize`.
- **Do** derive muted text and borders from `inkAlpha`/`whiteAlpha`/`limeAlpha`.
  **Don't** hard-code a new hex tint — add real tokens to `colors.ts` (and
  mirror them on the watches) instead.
- **Do** keep Team A lime-on-ink and Team B `team-blue`; keep W/L badges
  consistent.
- **Do** pair Overline labels as 800 weight + wide tracking (1.4–1.5) at ~10px.
- **Don't** mix sharp and rounded corners in one view; prefer the rounding scale.
- **Do** keep the primary action on a **fixed footer** on long screens so it
  never scrolls away.
- **Do** maintain strong contrast — ink/white on their opposite; treat WCAG AA
  (4.5:1 body text) as the floor.

## Platforms & Mirroring

The palette is defined once on phone and **hand-mirrored** onto each wearable —
watches are visual mirrors, not new designs.

- **Phone (Tamagui)** — `apps/mobile/src/theme/colors.ts` is canonical: the full
  18-color palette + the three alpha helpers, wired into Tamagui via
  `tokens.color` and the `$heading`/`$body` fonts in `tamagui.config.ts`. The
  UI atoms live in `apps/mobile/src/components/ui.tsx`.
- **Apple Watch (SwiftUI)** — `apps/mobile/targets/watch/Theme.swift`, `enum
  Court` carries just `ink`, `lime`, `white` as exact `/255` fractions
  (watch surfaces are near-black only). System SwiftUI text stands in for Anton.
- **Wear OS (Compose)** — `apps/watch-wear/.../ui/Colors.kt`, `object
  CourtColors` as ARGB longs (`Ink 0xFF0E1116`, `Lime 0xFFC6F135`, plus
  `InkDeep`, `Greige`, and true `Black 0xFF000000` for OLED battery), with
  pre-baked white opacities (`White45`/`White40`/`White25`) standing in for the
  phone's `whiteAlpha` helper. `ui/Text.kt` reimplements Display/Label/Body +
  ResultBadge + Dot.

When you add or change a token: update **DESIGN.md**, then `colors.ts` (the
canonical source), then mirror the shared anchors onto `Theme.swift` and
`Colors.kt`. Never let the three drift.
