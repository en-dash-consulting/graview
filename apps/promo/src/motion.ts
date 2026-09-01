import { Easing, interpolate, spring } from "remotion";

/** Shared spring configs — one motion language across the cut. */
export const springs = {
  soft: { damping: 200, stiffness: 80, mass: 1.1 },
  enter: { damping: 18, stiffness: 120, mass: 0.9 },
  snap: { damping: 14, stiffness: 180, mass: 0.7 },
  settle: { damping: 28, stiffness: 90, mass: 1.2 },
  /** Snappy-yet-smooth for camera-adjacent UI */
  premium: { damping: 16, stiffness: 140, mass: 0.75 },
} as const;

export const easings = {
  cinematic: Easing.bezier(0.4, 0.0, 0.2, 1),
  softOut: Easing.bezier(0.22, 1, 0.36, 1),
  softIn: Easing.bezier(0.4, 0, 1, 1),
  cross: Easing.bezier(0.45, 0, 0.55, 1),
  /** Decisive mask / wipe entrances */
  wipe: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export function fadeIn(
  frame: number,
  start: number,
  dur = 16,
  easing = easings.softOut,
) {
  return interpolate(frame, [start, start + dur], [0, 1], {
    ...clamp,
    easing,
  });
}

export function fadeOut(
  frame: number,
  start: number,
  dur = 14,
  easing = easings.softIn,
) {
  return interpolate(frame, [start, start + dur], [1, 0], {
    ...clamp,
    easing,
  });
}

export function fadeWindow(
  frame: number,
  appearAt: number,
  disappearAt: number | undefined,
  inDur = 16,
  outDur = 14,
) {
  const inn = fadeIn(frame, appearAt, inDur);
  const out =
    disappearAt === undefined ? 1 : fadeOut(frame, disappearAt, outDur);
  return inn * out;
}

/** Soft blur-in companion for premium plates (px). */
export function blurIn(frame: number, start: number, dur = 18, from = 12) {
  return interpolate(frame, [start, start + dur], [from, 0], {
    ...clamp,
    easing: easings.softOut,
  });
}

export function scaleIn(
  frame: number,
  start: number,
  dur = 20,
  from = 0.94,
  to = 1,
) {
  return interpolate(frame, [start, start + dur], [from, to], {
    ...clamp,
    easing: easings.softOut,
  });
}

export function springProgress(
  frame: number,
  fps: number,
  delay: number,
  config: keyof typeof springs = "enter",
) {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: springs[config],
  });
}

/** Stagger delay helper for N items. */
export function stagger(i: number, step = 3, base = 0) {
  return base + i * step;
}

/** Mask wipe progress 0→1 for decisive type entrances. */
export function maskWipe(frame: number, start: number, dur = 16) {
  return interpolate(frame, [start, start + dur], [0, 1], {
    ...clamp,
    easing: easings.wipe,
  });
}
