---
paths:
  - "apps/mobile/src/theme/**"
  - "apps/mobile/src/components/**"
  - "apps/mobile/targets/watch/*.swift"
  - "apps/watch-wear/app/src/main/java/com/holypadel/wear/ui/**"
---

# Design system — Court Bold

`DESIGN.md` at the repo root is the token source of truth: Court Bold — Anton
display + Archivo body, ball-lime `#C6F135` on ink `#0E1116` over cream `#F1F0EA`.
When a value is in doubt, `DESIGN.md` wins.

## Where tokens live

- **`apps/mobile/src/theme/colors.ts` is the canonical palette.** All app colour
  comes from here (the `colors` const and the `inkAlpha` / `whiteAlpha` /
  `limeAlpha` helpers). Don't hard-code hex in components.
- The watches **mirror** this palette — they don't own colours:
  - watchOS: `Court` in `apps/mobile/targets/watch/Theme.swift`.
  - Wear OS: `CourtColors`.
- Adding or changing a token is a three-place edit: `DESIGN.md` (the token),
  `colors.ts` (canonical), then mirror it on both watches. Never introduce a new
  colour by hard-coding it in one surface.

## Anton (Display) — never tighten the line height

Anton has tall round glyphs that clip when the line box is short — a tightly-led
`0` reads as `U`. **Leave `lineHeight` unset on any Anton / Display text**, or set
it to at least ~1.3× the `fontSize`. This applies to every score numeral, set
count, and display heading across phone and both watches.

## Colour intent

- **Lime is reserved for signal only** — serve indicator, primary CTA, the live /
  active accent. It is not a decorative fill. Ink and cream carry the layout;
  lime marks the one thing that matters right now.
- **Teams read by colour**: Team A is lime-on-ink; Team B is `teamBlue`
  (`#2E5BFF`). Keep that pairing consistent wherever both teams appear.
- Use `danger` for destructive actions only.

## Cross-surface

Any visual change that should be uniform (a new accent, a spacing scale, a team
colour tweak) must land in `DESIGN.md` + `colors.ts` and be mirrored on watchOS
`Court` and Wear `CourtColors` in the same logical change — don't let the three
surfaces drift.
