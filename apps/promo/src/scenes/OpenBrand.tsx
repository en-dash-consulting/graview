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

/** Cold open: En Dash mark → “presents” → GRAVIEW display. */
export const OpenBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 10, beats.open.duration - 28, 24);
  const mark = springProgress(frame, fps, 4, "premium");
  const presents = springProgress(frame, fps, 18, "enter");
  const title = springProgress(frame, fps, 36, "premium");
  const glow = interpolate(frame, [0, 50], [0.15, 0.5], {
    ...clamp,
    easing: easings.softOut,
  });

  return (
    <AbsoluteFill style={{ opacity, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          transform: `scale(${0.94 + mark * 0.06})`,
          filter: `drop-shadow(0 24px 70px rgba(0,229,185,${glow}))`,
        }}
      >
        <Img
          src={staticFile("endash-mark.svg")}
          style={{
            width: 88,
            height: 88,
            opacity: mark,
          }}
        />
        <div
          style={{
            opacity: presents,
            transform: `translateY(${(1 - presents) * 8}px)`,
            fontFamily: fonts.literary,
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: 26,
            letterSpacing: 1.2,
            color: colors.offWhite,
          }}
        >
          presents
        </div>
        <div
          style={{
            opacity: title,
            transform: `translateY(${(1 - title) * 14}px)`,
            fontFamily: fonts.display,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: 8,
            color: colors.white,
            textShadow:
              "0 0 48px rgba(0,229,185,0.28), 0 22px 70px rgba(0,0,0,0.65)",
          }}
        >
          GRAVIEW
        </div>
      </div>
    </AbsoluteFill>
  );
};
