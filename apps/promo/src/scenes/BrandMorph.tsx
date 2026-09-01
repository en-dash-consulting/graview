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
 * One idea: ToDo sample → En Dash house brand.
 * Morph from todo UI chrome into the En Dash mark + “Dash” wordmark.
 * Mark already contains “en” — wordmark is “Dash” only.
 */
export const BrandMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = beats.brand.duration;
  const opacity = beatOpacity(frame, 0, 18, dur - 28, 26);

  // Morph compressed into the ~5s window
  const t = interpolate(frame, [10, 110], [0, 1], {
    ...clamp,
    easing: easings.cinematic,
  });
  const sampleOpacity = interpolate(t, [0, 0.42], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const sampleScale = interpolate(t, [0, 0.42], [1, 0.78], {
    ...clamp,
    easing: easings.softIn,
  });
  const enOpacity = interpolate(t, [0.32, 0.72], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const enScale = 0.82 + springProgress(frame, fps, 48, "settle") * 0.18;
  // Wordmark “Dash” only — mark carries the “en”
  const wordReveal = interpolate(t, [0.55, 0.88], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const flash = interpolate(t, [0.38, 0.46, 0.54], [0, 1, 0], clamp);

  const sampleRot = interpolate(t, [0, 0.42], [0, -8], clamp);

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
        {/* ToDo sample app chrome */}
        <div
          style={{
            position: "absolute",
            opacity: sampleOpacity,
            transform: `scale(${sampleScale}) rotate(${sampleRot}deg)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 420,
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(0,229,185,0.35)",
              boxShadow:
                "0 28px 80px rgba(0,0,0,0.45), 0 0 40px rgba(0,229,185,0.12)",
              background: colors.fieldElevated,
            }}
          >
            <Img
              src={staticFile("survey/todo-selected-dark.png")}
              style={{ width: "100%", display: "block" }}
            />
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
            ToDo
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
            sample app
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
        line="Sample app → house brand."
        appearAt={2}
        disappearAt={36}
        size={34}
        voice="literary"
        place="lower"
      />
    </AbsoluteFill>
  );
};
