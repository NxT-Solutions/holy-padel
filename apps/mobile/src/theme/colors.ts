/**
 * "Court Bold" palette, lifted verbatim from design/Padel Score Tracker.dc.html:
 * Anton numerals, Archivo UI, ball-lime on near-black over warm cream.
 *
 * Two palettes — light (the design default) and dark — share every *surface*
 * token that is already dark (ink family, lime) and swap the light screen,
 * cards, and text colors. Theme selection lives in the `theme` setting
 * (settings table) and is applied by the ThemeProvider via `applyTheme`.
 */

export type ThemeMode = "light" | "dark";

const LIGHT = {
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
  /** Lime legible on a light card (active set label). */
  limeOnCard: "#7F9A12",
  /** Screen background. */
  screen: "#F1F0EA",
  /** Card surface on the screen background. */
  card: "#FFFFFF",
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
  /** Pure white — text on ink surfaces, accents. */
  white: "#FFFFFF",
  /** Body text on cards. */
  text: "#0E1116",
  /** Team B accent. */
  teamBlue: "#2E5BFF",
  /** Destructive actions (delete match). */
  danger: "#C43F3F",
};

const DARK: typeof LIGHT = {
  ink: "#0E1116",
  inkDeep: "#07090C",
  inkCard: "#12161C",
  inkRaised: "#151922",
  inkChip: "#1B2027",
  inkButton: "#181D24",
  lime: "#C6F135",
  limeOnCard: "#C6F135",
  screen: "#0B0D11",
  card: "#12161C",
  sheet: "#10141A",
  input: "#1B2027",
  row: "#161A21",
  toggle: "#1B2027",
  greige: "#262C36",
  white: "#FFFFFF",
  text: "#F1F0EA",
  teamBlue: "#2E5BFF",
  danger: "#C43F3F",
};

/** The resolved palette — its values are swapped in place by `applyTheme`. */
export const colors = { ...LIGHT };

/** Body-text color at the design's text opacities — theme aware. */
export function textAlpha(alpha: number): string {
  return mode === "dark"
    ? `rgba(241, 240, 234, ${String(alpha)})`
    : `rgba(14, 17, 22, ${String(alpha)})`;
}

/** rgba(255, 255, 255, alpha) — white at the design's text opacities. */
export function whiteAlpha(alpha: number): string {
  return `rgba(255, 255, 255, ${String(alpha)})`;
}

/** rgba(198, 241, 53, alpha) — the lime glow behind serve dots and CTAs. */
export function limeAlpha(alpha: number): string {
  return `rgba(198, 241, 53, ${String(alpha)})`;
}

let mode: ThemeMode = "light";

/** The currently applied palette mode. */
export function themeMode(): ThemeMode {
  return mode;
}

const listeners = new Set<() => void>();

/** Subscribe to theme flips (useSyncExternalStore) — see ThemeController. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/**
 * Swap the palette in place. Called by the ThemeProvider during render —
 * every component that reads `colors` picks the mode up on its next render
 * without per-component subscriptions. Callers must eventually
 * `notifyThemeChanged()` (after commit) so root-level consumers re-render.
 */
export function applyTheme(next: ThemeMode): void {
  mode = next;
  Object.assign(colors, next === "dark" ? DARK : LIGHT);
}

/** Fire the theme subscriptions — after commit (useLayoutEffect). */
export function notifyThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
