import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  blurIn,
  clamp,
  easings,
  fadeWindow,
  springProgress,
} from "../motion";
import { colors, fonts } from "../theme";

type Corner = "tr" | "br" | "tl" | "bl" | "center" | "mr" | "ml" | "tc" | "bc";

type Props = {
  src: string;
  label?: string;
  appearAt?: number;
  disappearAt?: number;
  corner?: Corner;
  width?: number;
  /** Primary Y-axis tilt (stronger = more spatial) */
  tilt?: number;
  /** Extra rotateX for altitude parallax */
  tiltX?: number;
  /** Parallax offset vs camera (px) — positive = nearer */
  parallax?: number;
  /** Depth 0–1 for environmental shadow weight */
  depth?: number;
  /** Extra pixel nudge from the corner/edge anchor */
  offsetX?: number;
  offsetY?: number;
  /** Longer crossfades for continuous story overlaps */
  fadeInDur?: number;
  fadeOutDur?: number;
};

/** Glass device insert in space — tilt, edge glow, env shadow, parallax. */
export const SurveyInsert: React.FC<Props> = ({
  src,
  label,
  appearAt = 0,
  disappearAt,
  corner = "tr",
  width = 720,
  tilt = -8,
  tiltX = 6,
  parallax = 0,
  depth = 0.35,
  offsetX = 0,
  offsetY = 0,
  fadeInDur = 18,
  fadeOutDur = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeWindow(frame, appearAt, disappearAt, fadeInDur, fadeOutDur);
  const enter = springProgress(frame, fps, appearAt, "premium");
  const scale = 0.88 + enter * 0.12;
  const blur = blurIn(frame, appearAt, 18, 8);
  const floatY =
    Math.sin(Math.max(0, frame - appearAt) * 0.055) * (3 + depth * 4);
  const wipe = interpolate(frame, [appearAt, appearAt + 20], [0, 100], {
    ...clamp,
    easing: easings.wipe,
  });
  const glowPulse =
    0.35 + 0.15 * Math.sin(Math.max(0, frame - appearAt) * 0.08);

  const positions: Record<Corner, React.CSSProperties> = {
    tr: { top: 56, right: 56 },
    br: { bottom: 96, right: 56 },
    tl: { top: 56, left: 56 },
    bl: { bottom: 96, left: 56 },
    center: { top: "50%", left: "50%" },
    mr: { top: "42%", right: 40 },
    ml: { top: "42%", left: 40 },
    tc: { top: 40, left: "50%" },
    bc: { bottom: 88, left: "50%" },
  };

  const isCenterish = corner === "center" || corner === "tc" || corner === "bc";
  const isRight = corner.includes("r") && corner !== "center";
  const isLeft = corner.includes("l") && corner !== "center";

  const origin = isCenterish
    ? "center center"
    : isRight
      ? "right center"
      : isLeft
        ? "left center"
        : "center center";

  const px =
    offsetX +
    parallax * (isRight ? 1 : isLeft ? -1 : 0);
  const py = offsetY + parallax * 0.35 + floatY;

  const baseTransform = isCenterish
    ? `translate(-50%, ${corner === "center" ? "-50%" : "0"}) translate(${px}px, ${py}px) scale(${scale}) perspective(1600px) rotateY(${tilt}deg) rotateX(${tiltX}deg)`
    : `translate(${px}px, ${py}px) scale(${scale}) perspective(1600px) rotateY(${tilt}deg) rotateX(${tiltX}deg)`;

  const shadowY = 28 + depth * 50;
  const shadowBlur = 60 + depth * 80;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Environmental contact shadow */}
      <div
        style={{
          position: "absolute",
          ...positions[corner],
          width: width * 0.92,
          height: 28,
          marginTop: corner.includes("b") ? undefined : width * 0.55,
          marginBottom: corner.includes("b") ? 8 : undefined,
          opacity: opacity * (0.35 + depth * 0.4),
          transform: isCenterish
            ? `translate(-50%, 0) scaleX(1.05) rotateY(${tilt * 0.4}deg)`
            : `translateX(${px * 0.5}px) scaleX(1.05) rotateY(${tilt * 0.4}deg)`,
          transformOrigin: origin,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, transparent 70%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          ...positions[corner],
          width,
          opacity,
          transform: baseTransform,
          transformOrigin: origin,
          filter: `blur(${blur}px)`,
          borderRadius: 20,
          padding: 11,
          background: `
            linear-gradient(155deg,
              rgba(20, 34, 68, 0.72) 0%,
              rgba(0, 23, 105, 0.55) 55%,
              rgba(8, 16, 34, 0.78) 100%
            )
          `,
          border: `1px solid rgba(0,229,185,${0.35 + glowPulse * 0.25})`,
          boxShadow: `
            0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,${0.55 + depth * 0.25}),
            0 12px 40px rgba(0,23,105,0.5),
            0 0 ${28 + glowPulse * 20}px rgba(0,229,185,${0.12 + glowPulse * 0.1}),
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -1px 0 rgba(0,229,185,0.08)
          `,
          backdropFilter: "blur(22px) saturate(1.15)",
        }}
      >
        {/* Glass sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 20,
            background:
              "linear-gradient(125deg, rgba(255,255,255,0.1) 0%, transparent 42%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Edge glow rim */}
        <div
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 21,
            background: `linear-gradient(160deg, rgba(0,229,185,${0.25 * glowPulse}), transparent 40%, transparent 70%, rgba(0,23,105,0.35))`,
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            clipPath: `inset(0 ${100 - wipe}% 0 0)`,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)",
            background: colors.fieldElevated,
            zIndex: 1,
          }}
        >
          <Img
            src={staticFile(src)}
            style={{ width: "100%", display: "block" }}
          />
        </div>
        {label ? (
          <div
            style={{
              position: "absolute",
              left: 18,
              bottom: 16,
              padding: "3px 8px",
              borderRadius: 4,
              background: "rgba(5,11,26,0.78)",
              color: colors.muted,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              opacity: 0.85,
              zIndex: 2,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
