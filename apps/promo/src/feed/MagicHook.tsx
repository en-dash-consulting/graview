import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";
import { BeautyPlate } from "./BeautyPlate";

/**
 * Magic first — open on Seedbed light beauty (seedbed-planted).
 * Large framed light UI on navy. Caption late: “One declaration.”
 */
export const MagicHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.magic.duration;

  const exit = interpolate(frame, [dur - 16, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const flash = interpolate(frame, [0, 5, 18], [0.14, 0.04, 0], clamp);

  const plate = springProgress(frame, fps, 4, "settle");
  const plateOpacity = interpolate(frame, [0, 14], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });

  const caption = springProgress(frame, fps, 88, "enter");
  const captionOut = interpolate(frame, [dur - 20, dur - 8], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.field,
        opacity: exit,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,23,105,0.75) 0%, transparent 62%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(0,229,185,0.1) 0%, transparent 48%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: colors.mint,
          opacity: flash,
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          opacity: plateOpacity,
          transform: `scale(${0.97 + plate * 0.03})`,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: FEED_SAFE.top,
          paddingBottom: FEED_SAFE.bottom + 56,
        }}
      >
        <BeautyPlate
          src="beauty/seedbed-planted-light.png"
          scale={1.14}
          objectPosition="48% 42%"
          driftTo={1.04}
          driftFrames={dur}
          height={780}
          liveChip
        />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 28,
          textAlign: "center",
          opacity: caption * captionOut,
          transform: `translateY(${(1 - caption) * 10}px)`,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: -0.3,
          color: colors.offWhite,
          textShadow: "0 8px 28px rgba(0,0,0,0.75)",
        }}
      >
        One declaration.
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.38) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
