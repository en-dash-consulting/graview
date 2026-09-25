import { colors, fonts } from "./theme";

/** Feed-optimized square promo — LinkedIn / IG feed (mute-first). */
export const FEED_WIDTH = 1080;
export const FEED_HEIGHT = 1080;
export const FEED_FPS = 30;
export const FEED_DURATION = 660; // 22s — slower open + readable steps

/** Safe margins for LinkedIn/IG crop (~48–64px). */
export const FEED_SAFE = {
  top: 56,
  bottom: 56,
  side: 56,
} as const;

/**
 * Kinetic product story (magic → tagline → steps → montage → lock → CTA).
 * 660 frames / 22s @ 30fps — open breathes; Declare/Derive/Ship are communication.
 */
export const feedBeats = {
  magic: { from: 0, duration: 135 }, // 0–4.5s
  tagline: { from: 135, duration: 120 }, // 4.5–8.5s
  steps: { from: 255, duration: 54 }, // 8.5–10.3s — big Declare → Derive → Ship
  montage: { from: 309, duration: 252 }, // 10.3–18.7s
  lockup: { from: 561, duration: 54 }, // 18.7–20.5s
  cta: { from: 615, duration: 45 }, // 20.5–22.0s
} as const;

export { colors, fonts };
