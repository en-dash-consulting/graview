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
 * Payoff line — huge type, hard cuts / snappy springs.
 * "Declare the domain." → "The application follows."
 * No shrink animation.
 */
export const TaglinePayoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.tagline.duration;

  const line1 = springProgress(frame, fps, 2, "snap");
  const underline = springProgress(frame, fps, 10, "premium");
  // Hard cut feel: second line snaps in mid-beat
  const line2 = springProgress(frame, fps, 38, "snap");
  const mintFlash = interpolate(frame, [38, 42, 52], [0, 0.22, 0], clamp);
  const exit = interpolate(frame, [dur - 10, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  // Line 1 holds, then soft-dims as line 2 owns the frame
  const line1Hold = interpolate(frame, [36, 48], [1, 0.55], clamp);

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
            "radial-gradient(ellipse at 50% 48%, rgba(0,23,105,0.6) 0%, transparent 62%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: colors.mint,
          opacity: mintFlash,
          pointerEvents: "none",
        }}
      />

      <div style={{ textAlign: "center", maxWidth: 960, width: "100%" }}>
        <div
          style={{
            opacity: line1 * line1Hold,
            transform: `translateY(${(1 - line1) * 28}px)`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 86,
            lineHeight: 1.02,
            letterSpacing: -1.4,
            color: colors.white,
            textShadow: "0 16px 56px rgba(0,0,0,0.5)",
            marginBottom: 12,
          }}
        >
          Declare the domain.
        </div>

        <div
          style={{
            width: interpolate(underline, [0, 1], [0, 220]),
            height: 5,
            backgroundColor: colors.mint,
            borderRadius: 3,
            margin: "0 auto 36px",
            opacity: underline * line1Hold,
            boxShadow: "0 0 24px rgba(0,229,185,0.55)",
          }}
        />

        <div
          style={{
            opacity: line2,
            transform: `translateY(${(1 - line2) * 24}px)`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: -1.0,
            color: colors.mint,
            textShadow: "0 0 48px rgba(0,229,185,0.35), 0 12px 40px rgba(0,0,0,0.45)",
          }}
        >
          The application follows.
        </div>
      </div>
    </AbsoluteFill>
  );
};
