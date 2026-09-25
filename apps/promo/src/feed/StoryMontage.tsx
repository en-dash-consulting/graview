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
 * Causal cinematic montage — one graph → many derived faces.
 * Punch-ins (cover + scale 1.7–2.3), cross-dissolves ≤6f, scale pops, slight rotate.
 * Declare / Derive / Ship ticks as chrome only — not hero cards.
 */
const SHOTS = [
  {
    src: "survey/todo-graview-dark.png",
    caption: null as string | null,
    from: 0,
    hold: 44,
    objectPosition: "50% 40%",
    scale: 1.95,
    rotate: -1.5,
  },
  {
    src: "survey/todo-zoomed-dark.png",
    caption: null as string | null,
    from: 38,
    hold: 18,
    objectPosition: "48% 38%",
    scale: 2.15,
    rotate: 0.8,
  },
  {
    src: "site/todo-week-dark.png",
    caption: "Calendar from the graph.",
    from: 50,
    hold: 44,
    objectPosition: "62% 42%",
    scale: 1.9,
    rotate: -0.8,
  },
  {
    src: "site/todo-selected-dark.png",
    caption: "Same buttons for you and your agent.",
    from: 90,
    hold: 46,
    objectPosition: "20% 40%",
    scale: 2.1,
    rotate: 1.2,
  },
  {
    src: "site/coverage-dark.png",
    caption: "Lenses that rebind.",
    from: 132,
    hold: 48,
    objectPosition: "42% 52%",
    scale: 2.25,
    rotate: -1.0,
  },
] as const;

const TICKS = ["Declare", "Derive", "Ship"] as const;

const PLATE_H = 680;

export const StoryMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.montage.duration;

  const exit = interpolate(frame, [dur - 10, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  // Tick chrome progress — lights up as montage advances
  const tickPhase = interpolate(frame, [0, dur - 20], [0, 3], clamp);

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
        const local = frame - shot.from;
        const enter = springProgress(frame, fps, shot.from, "premium");
        // Cross-dissolve ≤6f into next (except last)
        const leaveStart = shot.from + shot.hold - 6;
        const leave =
          i === SHOTS.length - 1
            ? 1
            : interpolate(frame, [leaveStart, leaveStart + 6], [1, 0], {
                ...clamp,
                easing: easings.cross,
              });
        const opacity = enter * leave;
        // Scale pop on enter + tiny drift
        const pop = interpolate(enter, [0, 1], [0.88, 1]);
        const drift = interpolate(
          Math.max(0, local),
          [0, Math.max(1, shot.hold)],
          [1, 1.04],
          clamp,
        );
        const y = interpolate(enter, [0, 1], [36, 0]);
        const rot = interpolate(enter, [0, 1], [shot.rotate * 1.6, shot.rotate]);

        return (
          <AbsoluteFill
            key={`${shot.src}-${shot.from}`}
            style={{
              opacity,
              justifyContent: "flex-start",
              alignItems: "center",
              paddingLeft: FEED_SAFE.side,
              paddingRight: FEED_SAFE.side,
              paddingTop: FEED_SAFE.top + 8,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                transform: `translateY(${y}px) scale(${pop}) rotate(${rot}deg)`,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 22,
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
                    "0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,185,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
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
                    fontFamily: fonts.display,
                    fontWeight: 800,
                    fontSize: 38,
                    lineHeight: 1.12,
                    letterSpacing: -0.4,
                    color: colors.white,
                    textAlign: "center",
                    maxWidth: 920,
                    textShadow: "0 10px 36px rgba(0,0,0,0.75)",
                    minHeight: 48,
                  }}
                >
                  {shot.caption}
                </div>
              ) : (
                <div style={{ minHeight: 48 }} />
              )}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Declare / Derive / Ship chrome ticks — not hero */}
      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 4,
          display: "flex",
          justifyContent: "center",
          gap: 28,
          opacity: interpolate(frame, [4, 14], [0, 1], clamp),
        }}
      >
        {TICKS.map((tick, i) => {
          const active = tickPhase >= i && tickPhase < i + 1.15;
          const lit = tickPhase >= i ? 1 : 0.35;
          return (
            <div
              key={tick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: lit,
                transform: active ? "scale(1.05)" : "scale(1)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: active ? colors.mint : colors.muted,
                  boxShadow: active
                    ? "0 0 12px rgba(0,229,185,0.7)"
                    : undefined,
                }}
              />
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: active ? colors.mint : colors.muted,
                }}
              >
                {tick}
              </span>
            </div>
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
