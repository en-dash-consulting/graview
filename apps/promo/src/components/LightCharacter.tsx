import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, easings } from "../motion";
import { colors, STORY_FRAMES } from "../theme";

export const LightCharacter: React.FC = () => {
  const frame = useCurrentFrame();
  const f = Math.min(frame, STORY_FRAMES);
  const x = interpolate(
    f,
    [0, 80, 240, 450, 700, 900, 1100, 1260],
    [960, 960, 720, 960, 480, 960, 960, 960],
    { ...clamp, easing: easings.cinematic },
  );
  const y = interpolate(
    f,
    [0, 80, 240, 450, 700, 900, 1100, 1260],
    [480, 500, 430, 360, 220, 440, 400, 400],
    { ...clamp, easing: easings.cinematic },
  );
  const r = interpolate(f, [0, 100, 240, 500, 900, 1100], [10, 18, 40, 80, 100, 55], clamp);
  const opacity = interpolate(f, [0, 20, 1000, 1200], [0.2, 0.4, 0.4, 0.15], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: r * 2,
          height: r * 2,
          marginLeft: -r,
          marginTop: -r,
          borderRadius: "50%",
          opacity,
          background: `radial-gradient(circle, rgba(0,229,185,0.5) 0%, rgba(0,229,185,0.15) 40%, rgba(0,23,105,0.25) 62%, transparent 72%)`,
          filter: `blur(${Math.max(8, r * 0.35)}px)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
