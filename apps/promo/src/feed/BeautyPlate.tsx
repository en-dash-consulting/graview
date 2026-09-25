import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp } from "../motion";
import { colors, fonts, FEED_SAFE } from "../feedTheme";

type Props = {
  src: string;
  /** Extra zoom on cover — keep mild (1.05–1.25) for readable composition */
  scale?: number;
  objectPosition?: string;
  /** Ken Burns end scale multiplier from 1 */
  driftTo?: number;
  /** Local-frame duration for drift */
  driftFrames?: number;
  liveChip?: boolean;
  fadeInFrames?: number;
  borderRadius?: number;
  height?: number;
  /** Shift Ken Burns / fade to shot-local time */
  frameOffset?: number;
  style?: React.CSSProperties;
};

/**
 * Large clean light-UI card on navy field — the desire frame.
 * Soft shadow, thin mint border, mild punch-in only.
 */
export const BeautyPlate: React.FC<Props> = ({
  src,
  scale = 1.12,
  objectPosition = "50% 45%",
  driftTo = 1.03,
  driftFrames = 90,
  liveChip = true,
  fadeInFrames = 0,
  borderRadius = 18,
  height = 780,
  frameOffset = 0,
  style,
}) => {
  const global = useCurrentFrame();
  const frame = Math.max(0, global - frameOffset);
  const drift = interpolate(
    frame,
    [0, Math.max(1, driftFrames)],
    [1, driftTo],
    clamp,
  );
  const fade =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], clamp)
      : 1;

  const width = 1080 - FEED_SAFE.side * 2;

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        overflow: "hidden",
        position: "relative",
        opacity: fade,
        backgroundColor: "#F4F1EA",
        border: "1.5px solid rgba(0,229,185,0.42)",
        boxShadow:
          "0 28px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.35)",
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
          transform: `scale(${scale * drift})`,
          transformOrigin: objectPosition,
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 18%, transparent 82%, rgba(5,11,26,0.08) 100%)",
          pointerEvents: "none",
        }}
      />
      {liveChip ? (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            backgroundColor: "rgba(5,11,26,0.72)",
            border: "1px solid rgba(0,229,185,0.35)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              backgroundColor: colors.mint,
              boxShadow: "0 0 8px rgba(0,229,185,0.7)",
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: 0.6,
              color: colors.offWhite,
            }}
          >
            Live · Seedbed
          </span>
        </div>
      ) : null}
    </div>
  );
};
