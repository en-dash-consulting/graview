import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";

const STEPS = ["Declare", "Derive", "Ship"] as const;

/**
 * Short dedicated beat — big Declare → Derive → Ship as communication,
 * not decoration. ~1.8s between tagline and montage.
 */
export const StepsBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.steps.duration;

  const exit = interpolate(frame, [dur - 12, dur], [1, 0], {
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
            "radial-gradient(ellipse at 50% 48%, rgba(0,23,105,0.55) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          flexWrap: "nowrap",
        }}
      >
        {STEPS.map((step, i) => {
          const enter = springProgress(frame, fps, 4 + i * 10, "enter");
          return (
            <React.Fragment key={step}>
              {i > 0 ? (
                <span
                  style={{
                    opacity: springProgress(frame, fps, 8 + i * 10, "enter"),
                    fontFamily: fonts.display,
                    fontWeight: 600,
                    fontSize: 36,
                    color: colors.mint,
                    marginLeft: 4,
                    marginRight: 4,
                  }}
                >
                  →
                </span>
              ) : null}
              <div
                style={{
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 12}px)`,
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: 52,
                  letterSpacing: -0.6,
                  color: i === 0 ? colors.mint : colors.white,
                  textShadow: "0 10px 36px rgba(0,0,0,0.45)",
                }}
              >
                {step}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
