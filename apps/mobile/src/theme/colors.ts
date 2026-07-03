/**
 * "Court Bold" palette, lifted verbatim from design/Padel Score Tracker.dc.html:
 * Anton numerals, Archivo UI, ball-lime on near-black over warm cream.
 */
export const colors = {
  /** Primary near-black ink — dark cards, tab bar, avatars. */
  ink: "#0E1116",
  /** Darkest screen background (match won, live dark). */
  inkDeep: "#0B0D11",
  /** Dark surface card. */
  inkCard: "#12161C",
  /** Raised dark tile (match-won stat tiles). */
  inkRaised: "#151922",
  /** Dark chip (set score chip on dark). */
  inkChip: "#1B2027",
  /** Dark secondary button. */
  inkButton: "#181D24",
  /** Ball-lime accent. */
  lime: "#C6F135",
  /** Lime legible on white (active set label). */
  limeInk: "#7F9A12",
  /** Light screen background. */
  cream: "#F1F0EA",
  /** Bottom-sheet background. */
  sheet: "#F7F6F1",
  /** Search-field background. */
  input: "#ECEBE3",
  /** Player row background in setup cards. */
  row: "#F4F3EE",
  /** Segmented-control track. */
  toggle: "#EFEEE7",
  /** Muted chip — losses, empty bars. */
  greige: "#E4E2D9",
  white: "#FFFFFF",
  /** Team B accent. */
  teamBlue: "#2E5BFF",
  /** Destructive actions (delete match). */
  danger: "#C43F3F",
} as const;

/** rgba(14, 17, 22, alpha) — the ink at the design's text opacities. */
export function inkAlpha(alpha: number): string {
  return `rgba(14, 17, 22, ${String(alpha)})`;
}

/** rgba(255, 255, 255, alpha) — white at the design's text opacities. */
export function whiteAlpha(alpha: number): string {
  return `rgba(255, 255, 255, ${String(alpha)})`;
}

/** rgba(198, 241, 53, alpha) — the lime glow behind serve dots and CTAs. */
export function limeAlpha(alpha: number): string {
  return `rgba(198, 241, 53, ${String(alpha)})`;
}
