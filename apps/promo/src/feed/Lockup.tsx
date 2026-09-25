import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";

/**
 * Identity lock — GRAVIEW wordmark + thin credit line.
 */
export const Lockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.lockup.duration;

  const mark = springProgress(frame, fps, 2, "snap");
  const line = springProgress(frame, fps, 14, "premium");
  const credit = springProgress(frame, fps, 22, "enter");
  const exit = interpolate(frame, [dur - 8, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.field,
        opacity: exit,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: FEED_SAFE.side,
        paddingRight: FEED_SAFE.side,
        paddingTop: FEED_SAFE.top,
        paddingBottom: FEED_SAFE.bottom,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,23,105,0.55) 0%, transparent 58%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(0,229,185,0.1) 0%, transparent 40%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            opacity: mark,
            transform: `translateY(${(1 - mark) * 24}px) scale(${0.94 + mark * 0.06})`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 108,
            letterSpacing: 12,
            color: colors.white,
            textShadow:
              "0 0 56px rgba(0,229,185,0.28), 0 18px 48px rgba(0,0,0,0.5)",
          }}
        >
          GRAVIEW
        </div>

        <div
          style={{
            width: interpolate(line, [0, 1], [0, 160]),
            height: 2,
            backgroundColor: colors.mint,
            borderRadius: 1,
            opacity: line,
            boxShadow: "0 0 16px rgba(0,229,185,0.5)",
          }}
        />

        <div
          style={{
            opacity: credit,
            transform: `translateY(${(1 - credit) * 12}px)`,
            fontFamily: fonts.display,
            fontWeight: 500,
            fontSize: 28,
            letterSpacing: 1.4,
            color: colors.muted,
          }}
        >
          A development kit from En Dash
        </div>
      </div>
    </AbsoluteFill>
  );
};
