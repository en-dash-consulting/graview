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
  the bid-desk example: "#0078D4",
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
 * At composition 30fps → 16s = 480 frames.
 *
 * Story rebalanced: dense mid (coverage + brand) through ~32s, short settle
 * punch (~4s), then dip-to-white → outro. Total ≈ 52s.
 */
export const STORY_FRAMES = 1080; // 36s Graview body
export const DIP_WHITE_FRAMES = 18; // last frames of story → pure white
export const OUTRO_FRAMES = 480; // 16.0s bumper @ 30fps
export const DURATION_IN_FRAMES = STORY_FRAMES + OUTRO_FRAMES; // 1560 ≈ 52s

/** Soft-morph beat windows inside the continuous camera spine (story only). */
export const beats = {
  open: { from: 0, duration: 80 },
  glyphs: { from: 30, duration: 165 },
  /** Jack-in, brief title, affordance candy, exit */
  graph: { from: 165, duration: 155 },
  city: { from: 290, duration: 260 },
  /** Richer mid-story: empty cells, agent write, selective undo */
  coverage: { from: 520, duration: 300 },
  /** Clear the bid-desk example → En Dash mark morph (~5s) */
  brand: { from: 790, duration: 150 },
  /** Short punch lockup — ≤120 frames (~4s), not an end pad */
  settle: { from: 960, duration: 120 },
} as const;

export const tagline = "Declare the domain. The application follows.";
