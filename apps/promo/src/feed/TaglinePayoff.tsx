import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";

/**
 * Payoff line — air after hook, then hold each line ~1.5–1.8s.
 * Soft product underlay so it isn't a dead title card.
 */
export const TaglinePayoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.tagline.duration;

  // Delay first line so it doesn't slam on the heels of the hook
  const line1 = springProgress(frame, fps, 10, "enter");
  const underline = springProgress(frame, fps, 22, "settle");
  const line2 = springProgress(frame, fps, 58, "enter");
  const mintGlow = interpolate(frame, [58, 68, 88], [0, 0.08, 0], clamp);
  const exit = interpolate(frame, [dur - 14, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  const line1Hold = interpolate(frame, [56, 68], [1, 0.7], clamp);

  const under = interpolate(frame, [0, 20], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const underDrift = interpolate(frame, [0, dur], [1.15, 1.22], clamp);

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
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ opacity: 0.22 * under, pointerEvents: "none" }}>
        <Img
          src={staticFile("survey/todo-zoomed-dark.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "48% 40%",
            transform: `scale(${underDrift})`,
            transformOrigin: "48% 40%",
            filter: "brightness(0.7) contrast(1.05) saturate(0.9)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 48%, rgba(0,23,105,0.72) 0%, rgba(5,11,26,0.88) 70%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: colors.mint,
          opacity: mintGlow,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          textAlign: "center",
          maxWidth: 960,
          width: "100%",
          zIndex: 1,
        }}
      >
        <div
          style={{
            opacity: line1 * line1Hold,
            transform: `translateY(${(1 - line1) * 14}px)`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 86,
            lineHeight: 1.02,
            letterSpacing: -1.4,
            color: colors.white,
            textShadow: "0 16px 56px rgba(0,0,0,0.55)",
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
            boxShadow: "0 0 24px rgba(0,229,185,0.45)",
          }}
        />

        <div
          style={{
            opacity: line2,
            transform: `translateY(${(1 - line2) * 12}px)`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: -1.0,
            color: colors.mint,
            textShadow:
              "0 0 48px rgba(0,229,185,0.3), 0 12px 40px rgba(0,0,0,0.45)",
          }}
        >
          The application follows.
        </div>
      </div>
    </AbsoluteFill>
  );
};
