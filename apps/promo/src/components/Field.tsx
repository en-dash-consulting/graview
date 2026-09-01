import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../theme";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  children?: React.ReactNode;
  tint?: string;
  /** Mint bloom intensity 0–1 */
  bloom?: number;
  grainOpacity?: number;
};

/** Filmic dark control-surface: navy wash, mint bloom, vignette, animated grain. */
export const Field: React.FC<Props> = ({
  children,
  tint,
  bloom = 0.35,
  grainOpacity = 0.05,
}) => {
  const frame = useCurrentFrame();
  const grains = useMemo(() => {
    const rand = mulberry32(21);
    return Array.from({ length: 90 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: 0.6 + rand() * 1.8,
      phase: rand() * Math.PI * 2,
    }));
  }, []);

  const grainShift = (frame % 7) * 0.35;
  const bloomPulse = 0.88 + 0.12 * Math.sin(frame * 0.032);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tint ?? colors.field,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 42%, rgba(0,23,105,0.62) 0%, rgba(5,11,26,0.15) 48%, rgba(2,6,16,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 38%, rgba(0,229,185,${0.075 * bloom * bloomPulse}) 0%, transparent 42%)`,
          pointerEvents: "none",
        }}
      />

      {children}

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill style={{ pointerEvents: "none", opacity: grainOpacity }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {grains.map((g, i) => {
            const o =
              0.35 +
              0.65 *
                (0.5 +
                  0.5 *
                    Math.sin(frame * 0.55 + g.phase + grainShift + i * 0.13));
            return (
              <circle
                key={i}
                cx={`${(g.x + grainShift * (i % 3 === 0 ? 1 : -1) + 100) % 100}%`}
                cy={`${(g.y + grainShift * 0.4 + 100) % 100}%`}
                r={g.s}
                fill="#ffffff"
                fillOpacity={o}
              />
            );
          })}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
