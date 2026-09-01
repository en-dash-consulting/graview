import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity, dofBlur } from "../camera";
import { SurveyInsert } from "../components/SurveyInsert";
import { clamp, easings, fadeIn, springProgress, stagger } from "../motion";
import { colors, fonts } from "../theme";

/** One idea: GRAVIEW — the city from altitude. */
export const CityAltitude: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 18, durationInFrames - 32, 30);
  const plateOp = fadeIn(frame, 0, 28) * 0.42;
  const plateBlur = dofBlur(
    0.7,
    interpolate(frame, [0, 100], [0.4, 0.75], clamp),
    5,
  );
  const tracking = interpolate(frame, [20, 90], [22, 10], {
    ...clamp,
    easing: easings.softOut,
  });
  const letters = "GRAVIEW".split("");

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          opacity: plateOp,
          filter: `blur(${plateBlur}px)`,
          transform: `scale(${interpolate(frame, [0, 200], [1.05, 1], { ...clamp, easing: easings.cinematic })})`,
          transformOrigin: "50% 40%",
        }}
      >
        <Img
          src={staticFile("survey/proposal-graview-dark.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(0.75) brightness(0.55) contrast(1.08)",
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(5,11,26,0.45) 0%, rgba(5,11,26,0.6) 55%, rgba(5,11,26,0.9) 100%)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div style={{ display: "flex" }}>
          {letters.map((ch, i) => {
            const s = springProgress(frame, fps, stagger(i, 2, 18), "snap");
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: fonts.display,
                  fontSize: 148,
                  fontWeight: 800,
                  letterSpacing: tracking,
                  color: colors.white,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 22}px)`,
                  textShadow:
                    "0 0 56px rgba(0,229,185,0.3), 0 28px 90px rgba(0,0,0,0.7)",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      <SurveyInsert
        src="survey/the coaching example-graview-dark.png"
        appearAt={90}
        corner="br"
        width={440}
        tilt={9}
        tiltX={5}
        parallax={12}
        depth={0.4}
      />
    </AbsoluteFill>
  );
};
