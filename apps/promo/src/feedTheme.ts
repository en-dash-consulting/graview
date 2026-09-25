import { colors, fonts } from "./theme";

/** Feed-optimized square promo — LinkedIn / IG feed (mute-first). */
export const FEED_WIDTH = 1080;
export const FEED_HEIGHT = 1080;
export const FEED_FPS = 30;
export const FEED_DURATION = 450; // 15s

/** Safe margins for LinkedIn/IG crop (~48–64px). */
export const FEED_SAFE = {
  top: 56,
  bottom: 56,
  side: 56,
} as const;

/**
 * Kinetic product story beats (magic → tagline → montage → lock → CTA).
 * Prefer 450 frames / 15s @ 30fps.
 */
export const feedBeats = {
  magic: { from: 0, duration: 60 }, // 0–2.0s
  tagline: { from: 60, duration: 90 }, // 2.0–5.0s
  montage: { from: 150, duration: 180 }, // 5.0–11.0s
  lockup: { from: 330, duration: 66 }, // 11.0–13.2s
  cta: { from: 396, duration: 54 }, // 13.2–15.0s
} as const;

export { colors, fonts };
