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
 */
export const STORY_FRAMES = 1260; // 42s Graview body
export const DIP_WHITE_FRAMES = 18; // last frames of story → pure white
export const OUTRO_FRAMES = 480; // 16.0s bumper @ 30fps
export const DURATION_IN_FRAMES = STORY_FRAMES + OUTRO_FRAMES; // 1740 ≈ 58s

/** Soft-morph beat windows inside the continuous camera spine (story only). */
export const beats = {
  open: { from: 0, duration: 90 },
  glyphs: { from: 40, duration: 185 },
  /** Denser ~5.5s — jack-in, brief title, affordance candy, exit */
  graph: { from: 200, duration: 165 },
  city: { from: 345, duration: 215 },
  coverage: { from: 530, duration: 250 },
  brand: { from: 750, duration: 220 },
  settle: { from: 940, duration: 320 },
} as const;

export const tagline = "Declare the domain. The application follows.";
