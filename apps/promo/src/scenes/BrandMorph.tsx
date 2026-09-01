import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { BigTitle } from "../components/BigTitle";
import { clamp, easings, springProgress } from "../motion";
import { beats, colors, fonts } from "../theme";

/**
 * One idea: the bid-desk example → En Dash.
 * Mark already contains “en” — wordmark is “Dash” only (never “en En Dash”).
 * Strong crossfade morph over ~5s.
 */
export const BrandMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = beats.brand.duration;
  const opacity = beatOpacity(frame, 0, 12, dur - 22, 20);

  // Morph compressed into the 5s window
  const t = interpolate(frame, [10, 110], [0, 1], {
    ...clamp,
    easing: easings.cinematic,
  });
  const northOpacity = interpolate(t, [0, 0.42], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const northScale = interpolate(t, [0, 0.42], [1, 0.78], {
    ...clamp,
    easing: easings.softIn,
  });
  const enOpacity = interpolate(t, [0.32, 0.72], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const enScale =
    0.82 + springProgress(frame, fps, 48, "settle") * 0.18;
  // Wordmark “Dash” only — mark carries the “en”
  const wordReveal = interpolate(t, [0.55, 0.88], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const flash = interpolate(t, [0.38, 0.46, 0.54], [0, 1, 0], clamp);

  // the bid-desk example tile rotates slightly as it dissolves
  const northRot = interpolate(t, [0, 0.42], [0, -8], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(0,229,185,${
            flash * 0.28
          }) 0%, transparent 42%)`,
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {/* the bid-desk example sample domain */}
        <div
          style={{
            position: "absolute",
            opacity: northOpacity,
            transform: `scale(${northScale}) rotate(${northRot}deg)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 24,
              background: `linear-gradient(145deg, #1494E8, ${colors.the bid-desk example})`,
              boxShadow: "0 28px 80px rgba(0,120,212,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={108} height={108} viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="white"
                strokeOpacity="0.35"
                strokeWidth="2"
              />
              <path
                d="M60 18 L70 60 L60 102 L50 60 Z"
                fill="white"
                fillOpacity="0.95"
              />
              <path
                d="M18 60 L60 50 L102 60 L60 70 Z"
                fill="white"
                fillOpacity="0.55"
              />
              <circle cx="60" cy="60" r="6" fill="white" />
            </svg>
          </div>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: 4,
              color: colors.white,
            }}
          >
            the bid-desk example
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              letterSpacing: 2.5,
              color: colors.muted,
              textTransform: "uppercase",
            }}
          >
            sample domain
          </div>
        </div>

        {/* En Dash — mark (“en”) + wordmark “Dash” beside it */}
        <div
          style={{
            position: "absolute",
            opacity: enOpacity,
            transform: `scale(${enScale})`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 28,
            filter: "drop-shadow(0 24px 60px rgba(0,229,185,0.32))",
          }}
        >
          <Img
            src={staticFile("endash-mark.svg")}
            style={{ width: 168, height: 168 }}
          />
          <div
            style={{
              opacity: wordReveal,
              transform: `translateX(${(1 - wordReveal) * 20}px)`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: 3,
                color: colors.white,
              }}
            >
              Dash
            </div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 13,
                letterSpacing: 2.5,
                color: colors.mint,
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              house brand
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <BigTitle
        line="Sample domain → house brand."
        appearAt={2}
        disappearAt={36}
        size={34}
        voice="literary"
        place="lower"
      />
    </AbsoluteFill>
  );
};
