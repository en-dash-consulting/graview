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

/** Cold open: En Dash mark + wordmark — brand present before Graview story. */
export const OpenBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 10, beats.open.duration - 24, 22);
  const mark = springProgress(frame, fps, 4, "premium");
  const word = springProgress(frame, fps, 16, "enter");
  const glow = interpolate(frame, [0, 40], [0.15, 0.45], {
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
          gap: 28,
          transform: `scale(${0.9 + mark * 0.1})`,
          opacity: mark,
          filter: `drop-shadow(0 24px 70px rgba(0,229,185,${glow}))`,
        }}
      >
        <Img
          src={staticFile("endash-mark.svg")}
          style={{ width: 160, height: 160 }}
        />
        <div
          style={{
            opacity: word,
            transform: `translateY(${(1 - word) * 12}px)`,
            fontFamily: fonts.display,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: 6,
            color: colors.mint,
          }}
        >
          En Dash
        </div>
      </div>
    </AbsoluteFill>
  );
};
