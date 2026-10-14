/**
 * "Court Bold" palette, lifted verbatim from design/Padel Score Tracker.dc.html:
 * Anton numerals, Archivo UI, signal orange on near-black over warm cream.
 *
 * Two palettes — light (the design default) and dark — share every *surface*
 * token that is already dark (ink family, accent) and swap the light screen,
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
  /** Dark panel that hugs the screen in light mode (stat tiles, settings rows). */
  tileInk: "#0E1116",
  /** Light tile surface (stat tiles) — a card surface in dark mode. */
  tileWhite: "#FFFFFF",
  /** Signal-orange accent. */
  accent: "#FF6B35",
  /** Orange legible as text on a light card (active set label). */
  accentOnCard: "#C2410C",
  /** Ink for text/icons drawn on an accent fill — same in both palettes. */
  onAccent: "#0E1116",
  /** Sport markers (phone only): small dots, stripes and tags. */
  sportPadel: "#C8A464",
  sportSquash: "#8B7CFF",
  sportPickleball: "#19B5C8",
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
  /** Team B identity — slate. */
  teamB: "#8B7CFF",
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
  // The dark tile turns into a raised surface (still the darkest tile) and the
  // white tile into the raised card, so the light-mode hierarchy survives the
  // palette flip without a black tile vanishing into the near-black screen.
  tileInk: "#151922",
  tileWhite: "#1B2027",
  accent: "#FF6B35",
  accentOnCard: "#FF6B35",
  onAccent: "#0E1116",
  sportPadel: "#C8A464",
  sportSquash: "#8B7CFF",
  sportPickleball: "#19B5C8",
  screen: "#0B0D11",
  card: "#12161C",
  sheet: "#10141A",
  input: "#1B2027",
  row: "#161A21",
  toggle: "#1B2027",
  greige: "#262C36",
  white: "#FFFFFF",
  text: "#F1F0EA",
  teamB: "#8B7CFF",
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

/** One selectable highlight colour, with its darker text-on-light variant. */
export interface AccentChoice {
  readonly id: string;
  readonly label: string;
  readonly accent: string;
  /** The accent legible as TEXT on a light card (light mode only). */
  readonly onCard: string;
  readonly rgb: readonly [number, number, number];
}

/** One selectable Team B colour. */
export interface TeamColorChoice {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly rgb: readonly [number, number, number];
}

/**
 * The highlight colours offered in Settings. All are light enough that ink
 * (`onAccent`) reads on them, so no fill needs a per-colour text colour.
 */
export const ACCENT_CHOICES: readonly AccentChoice[] = [
  { id: "orange", label: "Orange", accent: "#FF6B35", onCard: "#C2410C", rgb: [255, 107, 53] },
  { id: "gold", label: "Gold", accent: "#FFB627", onCard: "#A16207", rgb: [255, 182, 39] },
  { id: "mint", label: "Mint", accent: "#2EE6A0", onCard: "#0F8A5F", rgb: [46, 230, 160] },
  { id: "sky", label: "Sky", accent: "#38BDF8", onCard: "#0369A1", rgb: [56, 189, 248] },
  { id: "pink", label: "Pink", accent: "#FF5FA2", onCard: "#BE185D", rgb: [255, 95, 162] },
];

/** The Team B colours offered in Settings; violet is the default. */
export const TEAM_B_CHOICES: readonly TeamColorChoice[] = [
  { id: "violet", label: "Violet", color: "#8B7CFF", rgb: [139, 124, 255] },
  { id: "slate", label: "Slate", color: "#5B6B82", rgb: [91, 107, 130] },
  { id: "blue", label: "Blue", color: "#2E5BFF", rgb: [46, 91, 255] },
  { id: "teal", label: "Teal", color: "#12A594", rgb: [18, 165, 148] },
];

const [DEFAULT_ACCENT] = ACCENT_CHOICES as readonly [AccentChoice];
const [DEFAULT_TEAM_B] = TEAM_B_CHOICES as readonly [TeamColorChoice];
let accentChoice: AccentChoice = DEFAULT_ACCENT;
let teamBChoice: TeamColorChoice = DEFAULT_TEAM_B;

/** The user's colour picks layered over a theme palette. */
function colorOverrides(): Pick<typeof LIGHT, "accent" | "accentOnCard" | "teamB"> {
  return {
    accent: accentChoice.accent,
    accentOnCard: mode === "dark" ? accentChoice.accent : accentChoice.onCard,
    teamB: teamBChoice.color,
  };
}

/** The ids of the colours currently applied. */
export function appliedColors(): { readonly accent: string; readonly teamB: string } {
  return { accent: accentChoice.id, teamB: teamBChoice.id };
}

/**
 * Apply the user's accent and Team B colours (unknown ids fall back to the
 * defaults). Like `applyTheme`, it swaps `colors` in place during render;
 * the caller notifies subscribers after commit.
 */
export function applyColors(accentId: string | undefined, teamBId: string | undefined): void {
  accentChoice = ACCENT_CHOICES.find((choice) => choice.id === accentId) ?? DEFAULT_ACCENT;
  teamBChoice = TEAM_B_CHOICES.find((choice) => choice.id === teamBId) ?? DEFAULT_TEAM_B;
  Object.assign(colors, colorOverrides());
}

/** The current accent as RGB — for colour scales that interpolate. */
export function accentRgb(): readonly [number, number, number] {
  return accentChoice.rgb;
}

/** The current Team B colour as RGB — for colour scales that interpolate. */
export function teamBRgb(): readonly [number, number, number] {
  return teamBChoice.rgb;
}

/** The current accent at `alpha` — the glow behind serve dots and CTAs. */
export function accentAlpha(alpha: number): string {
  const [r, g, b] = accentChoice.rgb;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/**
 * The phone-only marker colour for a sport — small dots, stripes and tags
 * only, never CTA fills or large areas (orange stays the one signal colour).
 * Text drawn on a sport-colour fill is `colors.onAccent` (ink). Padel is the
 * default when the config leaves `sport` unset.
 */
export function sportColor(sport: "padel" | "squash" | "pickleball" | undefined): string {
  if (sport === "squash") {
    return colors.sportSquash;
  }
  if (sport === "pickleball") {
    return colors.sportPickleball;
  }
  return colors.sportPadel;
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
  Object.assign(colors, next === "dark" ? DARK : LIGHT, colorOverrides());
}

/** Fire the theme subscriptions — after commit (useLayoutEffect). */
export function notifyThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
