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
import { colors, fonts } from "../theme";

/**
 * One idea: the bid-desk example → En Dash.
 * Mark contains “en” — wordmark beside mark, never stacked under it.
 */
export const BrandMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 14, durationInFrames - 26, 24);
  const t = interpolate(frame, [24, 150], [0, 1], {
    ...clamp,
    easing: easings.cinematic,
  });
  const northOpacity = interpolate(t, [0, 0.45], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const enOpacity = interpolate(t, [0.38, 0.8], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const enScale = 0.9 + springProgress(frame, fps, 85, "settle") * 0.1;
  const wordReveal = interpolate(t, [0.58, 0.85], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const flash = interpolate(t, [0.45, 0.5, 0.56], [0, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(0,229,185,${flash * 0.22}) 0%, transparent 42%)`,
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            opacity: northOpacity,
            transform: `scale(${interpolate(t, [0, 0.45], [1, 0.85], clamp)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: 22,
              background: `linear-gradient(145deg, #1494E8, ${colors.the bid-desk example})`,
              boxShadow: "0 28px 80px rgba(0,120,212,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={100} height={100} viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
              <path d="M60 18 L70 60 L60 102 L50 60 Z" fill="white" fillOpacity="0.95" />
              <path d="M18 60 L60 50 L102 60 L60 70 Z" fill="white" fillOpacity="0.55" />
              <circle cx="60" cy="60" r="6" fill="white" />
            </svg>
          </div>
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 3,
              color: colors.white,
            }}
          >
            the bid-desk example
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            opacity: enOpacity,
            transform: `scale(${enScale})`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 32,
            filter: "drop-shadow(0 24px 60px rgba(0,229,185,0.3))",
          }}
        >
          <Img
            src={staticFile("endash-mark.svg")}
            style={{ width: 152, height: 152 }}
          />
          <div
            style={{
              opacity: wordReveal,
              transform: `translateX(${(1 - wordReveal) * 16}px)`,
              fontFamily: fonts.display,
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: 2,
              color: colors.white,
            }}
          >
            En Dash
          </div>
        </div>
      </AbsoluteFill>

      <BigTitle
        line="Sample domain → house brand."
        appearAt={4}
        disappearAt={40}
        size={36}
        voice="literary"
        place="lower"
      />
    </AbsoluteFill>
  );
};
