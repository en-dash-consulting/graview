import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { clamp, easings } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";
import { BeautyPlate } from "./BeautyPlate";

/**
 * Beauty montage — light Seedbed plates, slow crossfades (~2.4s+).
 * Large framed light UI on navy. No dark ToDo harness crops.
 */
const CROSS = 12;

const SHOTS = [
  {
    src: "beauty/seedbed-planted-light.png",
    caption: "The graph is the interface.",
    from: 0,
    hold: 72,
    objectPosition: "48% 42%",
    scale: 1.12,
    step: 0, // Declare
  },
  {
    src: "beauty/13-the-gardens-own-face-light.png",
    caption: "An ordinary web app — from the same declaration.",
    from: 60,
    hold: 74,
    objectPosition: "50% 38%",
    scale: 1.08,
    step: 1, // Derive
  },
  {
    src: "beauty/05-a-seat-light.png",
    caption: "Same buttons for you and your agent.",
    from: 122,
    hold: 72,
    objectPosition: "42% 45%",
    scale: 1.14,
    step: 1, // Derive
  },
  {
    src: "beauty/03-the-agreement-light.png",
    caption: "Rules that repair.",
    from: 182,
    hold: 70,
    objectPosition: "50% 42%",
    scale: 1.16,
    step: 2, // Ship
  },
] as const;

const TICKS = ["Declare", "Derive", "Ship"] as const;
const PLATE_H = 700;

export const StoryMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = feedBeats.montage.duration;

  const exit = interpolate(frame, [dur - 14, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  let activeStep = 0;
  for (const shot of SHOTS) {
    if (frame >= shot.from + CROSS / 2) {
      activeStep = shot.step;
    }
  }

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
            "radial-gradient(ellipse at 50% 38%, rgba(0,23,105,0.55) 0%, transparent 68%)",
          pointerEvents: "none",
        }}
      />

      {SHOTS.map((shot, i) => {
        const local = Math.max(0, frame - shot.from);
        const isLast = i === SHOTS.length - 1;

        const enter = interpolate(
          frame,
          [shot.from, shot.from + CROSS],
          [0, 1],
          { ...clamp, easing: easings.softOut },
        );
        const leaveStart = shot.from + shot.hold - CROSS;
        const leave = isLast
          ? 1
          : interpolate(frame, [leaveStart, leaveStart + CROSS], [1, 0], {
              ...clamp,
              easing: easings.cross,
            });
        const opacity = enter * leave;

        const capIn = interpolate(local, [10, 22], [0, 1], {
          ...clamp,
          easing: easings.softOut,
        });

        return (
          <AbsoluteFill
            key={`${shot.src}-${shot.from}`}
            style={{
              opacity,
              justifyContent: "flex-start",
              alignItems: "center",
              paddingLeft: FEED_SAFE.side,
              paddingRight: FEED_SAFE.side,
              paddingTop: FEED_SAFE.top + 4,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <BeautyPlate
                src={shot.src}
                scale={shot.scale}
                objectPosition={shot.objectPosition}
                driftTo={1.025}
                driftFrames={shot.hold}
                height={PLATE_H}
                liveChip={i === 0}
                borderRadius={18}
                frameOffset={shot.from}
              />

              <div
                style={{
                  opacity: capIn,
                  fontFamily: fonts.display,
                  fontWeight: 800,
                  fontSize: 34,
                  lineHeight: 1.15,
                  letterSpacing: -0.3,
                  color: colors.white,
                  textAlign: "center",
                  maxWidth: 920,
                  textShadow: "0 10px 36px rgba(0,0,0,0.75)",
                  minHeight: 44,
                  paddingLeft: 8,
                  paddingRight: 8,
                }}
              >
                {shot.caption}
              </div>
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Big Declare → Derive → Ship bar */}
      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 16,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          padding: "16px 28px",
          borderRadius: 20,
          backgroundColor: "rgba(5,11,26,0.88)",
          border: "1px solid rgba(0,229,185,0.28)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          opacity: interpolate(frame, [4, 14], [0, 1], clamp),
        }}
      >
        {TICKS.map((tick, i) => {
          const active = activeStep === i;
          const passed = activeStep > i;
          const color = active
            ? colors.mint
            : passed
              ? colors.offWhite
              : colors.muted;
          return (
            <React.Fragment key={tick}>
              {i > 0 ? (
                <span
                  style={{
                    fontFamily: fonts.display,
                    fontWeight: 600,
                    fontSize: 28,
                    color: passed || active ? colors.mint : colors.muted,
                    opacity: 0.85,
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  →
                </span>
              ) : null}
              <span
                style={{
                  fontFamily: fonts.display,
                  fontWeight: active ? 700 : 600,
                  fontSize: active ? 36 : 32,
                  letterSpacing: -0.3,
                  color,
                  textShadow: active
                    ? "0 0 20px rgba(0,229,185,0.45)"
                    : undefined,
                  opacity: active ? 1 : passed ? 0.85 : 0.55,
                }}
              >
                {tick}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.32) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
