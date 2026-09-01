import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

const montserrat = loadMontserrat("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const merriweather = loadMerriweather("normal", {
  weights: ["300", "400", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const jetbrains = loadJetBrainsMono("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const colors = {
  navy: "#001769",
  mint: "#00E5B9",
  white: "#FFFFFF",
  offWhite: "#E8EEF8",
  field: "#050B1A",
  fieldElevated: "#0A1428",
  plane: "#0E1A36",
  muted: "#7A8BB0",
  danger: "#FF5C7A",
  glass: "rgba(14, 26, 54, 0.55)",
  glassBorder: "rgba(0, 229, 185, 0.28)",
} as const;

export const fonts = {
  display: montserrat.fontFamily,
  sans: montserrat.fontFamily,
  literary: merriweather.fontFamily,
  mono: jetbrains.fontFamily,
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/**
 * Timing (probed): endash-outro.mp4 = 16.000s @ 25fps / 400 source frames.
 * Played at OUTRO_PLAYBACK_RATE so composition frames = ceil(16 / rate * 30).
 *
 * Story: relations teach-beat (one graph → many surfaces), brief En Dash
 * bridge (no ToDo morph), short settle. Total ≈ 46s (36s story + ~10s outro).
 */
export const STORY_FRAMES = 1080; // 36s Graview body
export const DIP_WHITE_FRAMES = 18; // last frames of story → pure white
export const OUTRO_PLAYBACK_RATE = 1.6;
export const OUTRO_SOURCE_SECONDS = 16;
export const OUTRO_FRAMES = Math.ceil(
  (OUTRO_SOURCE_SECONDS / OUTRO_PLAYBACK_RATE) * FPS,
); // 1.6× → 300 frames (~10s)
export const DURATION_IN_FRAMES = STORY_FRAMES + OUTRO_FRAMES; // 1380 ≈ 46s

/** Soft-morph beat windows inside the continuous camera spine (story only). */
export const beats = {
  open: { from: 0, duration: 110 }, // ~3.7s — En Dash presents GRAVIEW
  glyphs: { from: 78, duration: 140 },
  /** Jack-in, brief title, affordance candy, exit */
  graph: { from: 165, duration: 155 },
  /** Trimmed GRAVIEW altitude — ~4.3s, not an 8s hang */
  city: { from: 290, duration: 130 },
  /** One graph → calendar · instructions · tools (~15s) */
  relations: { from: 400, duration: 450 },
  /** Brief En Dash mark lockup — bridge into settle (no ToDo) */
  brand: { from: 830, duration: 110 },
  /** Short punch lockup — ≤120 frames (~4s), not an end pad */
  settle: { from: 960, duration: 120 },
} as const;

export const tagline = "Declare the domain. The application follows.";
