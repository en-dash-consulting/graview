import { interpolate } from "remotion";
import { clamp, easings } from "./motion";
import { STORY_FRAMES } from "./theme";

export type CameraState = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  perspective: number;
  tiltX: number;
  focus: number;
  bloom: number;
  constellation: {
    bloom: number;
    pulse: number;
    drift: number;
    settle: number;
    edgeProgress: number;
  };
};

type Key = {
  at: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  tiltX: number;
  focus: number;
  bloom: number;
  cBloom: number;
  cPulse: number;
  cDrift: number;
  cSettle: number;
  cEdge: number;
};

/** Sparse camera voyage across the 36s story (rebalanced mid / short settle). */
const KEYS: Key[] = [
  {
    at: 0,
    x: 0,
    y: 6,
    scale: 1.05,
    rotate: -0.3,
    tiltX: 0,
    focus: 0.35,
    bloom: 0.4,
    cBloom: 0.02,
    cPulse: 0.12,
    cDrift: 0.5,
    cSettle: 0,
    cEdge: 0,
  },
  {
    at: 70,
    x: 0,
    y: 0,
    scale: 1.0,
    rotate: 0,
    tiltX: 0,
    focus: 0.55,
    bloom: 0.72,
    cBloom: 0.9,
    cPulse: 0.4,
    cDrift: 1.0,
    cSettle: 0,
    cEdge: 0.85,
  },
  {
    at: 185,
    x: 36,
    y: -10,
    scale: 1.1,
    rotate: 0.5,
    tiltX: 8,
    focus: 0.38,
    bloom: 0.55,
    cBloom: 0.55,
    cPulse: 0.2,
    cDrift: 0.6,
    cSettle: 0,
    cEdge: 1,
  },
  {
    at: 320,
    x: 0,
    y: 36,
    scale: 0.93,
    rotate: -0.2,
    tiltX: -5,
    focus: 0.72,
    bloom: 0.62,
    cBloom: 0.82,
    cPulse: 0.35,
    cDrift: 1.1,
    cSettle: 0,
    cEdge: 1,
  },
  {
    at: 560,
    x: -36,
    y: 8,
    scale: 1.02,
    rotate: -0.4,
    tiltX: 3,
    focus: 0.45,
    bloom: 0.52,
    cBloom: 0.55,
    cPulse: 0.28,
    cDrift: 0.55,
    cSettle: 0,
    cEdge: 0.9,
  },
  {
    // Mid coverage — hold for product teaching
    at: 700,
    x: -20,
    y: 4,
    scale: 1.04,
    rotate: -0.2,
    tiltX: 2,
    focus: 0.42,
    bloom: 0.48,
    cBloom: 0.5,
    cPulse: 0.22,
    cDrift: 0.4,
    cSettle: 0,
    cEdge: 0.85,
  },
  {
    at: 820,
    x: 0,
    y: 0,
    scale: 1.05,
    rotate: 0,
    tiltX: 0,
    focus: 0.42,
    bloom: 0.5,
    cBloom: 0.45,
    cPulse: 0.16,
    cDrift: 0.35,
    cSettle: 0.05,
    cEdge: 0.7,
  },
  {
    at: 980,
    x: 0,
    y: 0,
    scale: 1.0,
    rotate: 0,
    tiltX: 0,
    focus: 0.5,
    bloom: 0.68,
    cBloom: 1,
    cPulse: 0.14,
    cDrift: 0.3,
    cSettle: 0.85,
    cEdge: 1,
  },
  {
    // Hold brightness into white dip — never crush constellation into a void
    at: STORY_FRAMES - 24,
    x: 0,
    y: 0,
    scale: 1.0,
    rotate: 0,
    tiltX: 0,
    focus: 0.5,
    bloom: 0.85,
    cBloom: 0.75,
    cPulse: 0.1,
    cDrift: 0.2,
    cSettle: 1,
    cEdge: 1,
  },
  {
    at: STORY_FRAMES,
    x: 0,
    y: 0,
    scale: 1.0,
    rotate: 0,
    tiltX: 0,
    focus: 0.5,
    bloom: 0.95,
    cBloom: 0.55,
    cPulse: 0.08,
    cDrift: 0.12,
    cSettle: 1,
    cEdge: 1,
  },
];

function sampleProp(frame: number, pick: (k: Key) => number): number {
  return interpolate(
    frame,
    KEYS.map((k) => k.at),
    KEYS.map(pick),
    { ...clamp, easing: easings.cinematic },
  );
}

export function sampleCamera(frame: number): CameraState {
  const f = Math.min(frame, STORY_FRAMES);
  return {
    x: sampleProp(f, (k) => k.x),
    y: sampleProp(f, (k) => k.y),
    scale: sampleProp(f, (k) => k.scale),
    rotate: sampleProp(f, (k) => k.rotate),
    perspective: 1400,
    tiltX: sampleProp(f, (k) => k.tiltX),
    focus: sampleProp(f, (k) => k.focus),
    bloom: sampleProp(f, (k) => k.bloom),
    constellation: {
      bloom: sampleProp(f, (k) => k.cBloom),
      pulse: sampleProp(f, (k) => k.cPulse),
      drift: sampleProp(f, (k) => k.cDrift),
      settle: sampleProp(f, (k) => k.cSettle),
      edgeProgress: sampleProp(f, (k) => k.cEdge),
    },
  };
}

export function dofBlur(depth: number, focus: number, strength = 6): number {
  const delta = Math.abs(depth - focus);
  const nearBias = depth < focus ? 0.7 : 1;
  return Math.min(14, delta * strength * 2.2 * nearBias);
}

export function beatOpacity(
  frame: number,
  inStart: number,
  inDur: number,
  outStart: number,
  outDur: number,
): number {
  const inn = interpolate(frame, [inStart, inStart + inDur], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const out = interpolate(frame, [outStart, outStart + outDur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  return inn * out;
}
