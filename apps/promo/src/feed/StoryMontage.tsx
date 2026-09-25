import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { clamp, easings } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";

/**
 * One plate at a time — hold ≥2.2s, crossfade 10f.
 * Big bottom bar: Declare → Derive → Ship (phone-legible primary UI).
 * Declare on graph, Derive on UI plates, Ship near end.
 */
const CROSS = 10;

const SHOTS = [
  {
    src: "survey/todo-graview-dark.png",
    caption: null as string | null,
    from: 0,
    hold: 72,
    objectPosition: "50% 40%",
    scale: 2.2,
    step: 0, // Declare
  },
  {
    src: "site/todo-week-dark.png",
    caption: "Calendar from the graph.",
    from: 62,
    hold: 72,
    objectPosition: "62% 42%",
    scale: 2.15,
    step: 1, // Derive
  },
  {
    src: "site/todo-selected-dark.png",
    caption: "Same buttons for you and your agent.",
    from: 124,
    hold: 72,
    objectPosition: "18% 38%",
    scale: 2.35,
    step: 1, // Derive
  },
  {
    src: "site/coverage-dark.png",
    caption: "Lenses that rebind.",
    from: 186,
    hold: 66,
    objectPosition: "42% 52%",
    scale: 2.4,
    step: 2, // Ship
  },
] as const;

const TICKS = ["Declare", "Derive", "Ship"] as const;
const PLATE_H = 640; // slightly shorter to leave room for big step bar

export const StoryMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = feedBeats.montage.duration;

  const exit = interpolate(frame, [dur - 14, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  // Active step from current dominant shot
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
            "radial-gradient(ellipse at 50% 40%, rgba(14,26,54,0.95) 0%, transparent 70%)",
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

        const drift = interpolate(
          local,
          [0, Math.max(1, shot.hold)],
          [1, 1.025],
          clamp,
        );

        const capIn = interpolate(local, [8, 18], [0, 1], {
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
                gap: 18,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: PLATE_H,
                  borderRadius: 28,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "rgba(232,238,248,0.06)",
                  border: "2px solid rgba(0,229,185,0.48)",
                  boxShadow:
                    "0 28px 72px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,229,185,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 8,
                    borderRadius: 20,
                    overflow: "hidden",
                    backgroundColor: colors.fieldElevated,
                  }}
                >
                  <Img
                    src={staticFile(shot.src)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: shot.objectPosition,
                      transform: `scale(${shot.scale * drift})`,
                      transformOrigin: shot.objectPosition,
                      filter: "brightness(1.18) contrast(1.1) saturate(1.05)",
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(232,238,248,0.07) 0%, transparent 26%, transparent 70%, rgba(5,11,26,0.28) 100%)",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {shot.caption ? (
                <div
                  style={{
                    opacity: capIn,
                    fontFamily: fonts.display,
                    fontWeight: 800,
                    fontSize: 36,
                    lineHeight: 1.12,
                    letterSpacing: -0.4,
                    color: colors.white,
                    textAlign: "center",
                    maxWidth: 920,
                    textShadow: "0 10px 36px rgba(0,0,0,0.75)",
                    minHeight: 44,
                  }}
                >
                  {shot.caption}
                </div>
              ) : (
                <div style={{ minHeight: 44 }} />
              )}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Big Declare → Derive → Ship bar — primary readable UI */}
      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 20,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          padding: "18px 28px",
          borderRadius: 20,
          backgroundColor: "rgba(5,11,26,0.82)",
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
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
