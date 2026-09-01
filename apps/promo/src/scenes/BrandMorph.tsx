import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { clamp, easings, springProgress } from "../motion";
import { beats, colors, fonts } from "../theme";

/**
 * Brief En Dash mark lockup — bridge from relations into settle.
 * No ToDo sample, no “built with the kit” flash.
 */
export const BrandMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = beats.brand.duration;
  const opacity = beatOpacity(frame, 0, 16, dur - 24, 22);

  const lock = springProgress(frame, fps, 4, "settle");
  const wordReveal = interpolate(frame, [18, 42], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const glow = interpolate(frame, [0, 28, 70], [0, 1, 0.55], clamp);
  const scale = 0.88 + lock * 0.12;

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(0,229,185,${
            glow * 0.22
          }) 0%, transparent 44%)`,
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: lock,
            transform: `scale(${scale})`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 28,
            filter: "drop-shadow(0 24px 60px rgba(0,229,185,0.32))",
          }}
        >
          <Img
            src={staticFile("endash-mark.svg")}
            style={{ width: 156, height: 156 }}
          />
          <div
            style={{
              opacity: wordReveal,
              transform: `translateX(${(1 - wordReveal) * 18}px)`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: 3,
                color: colors.white,
              }}
            >
              En Dash
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
