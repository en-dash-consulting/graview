import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity, dofBlur } from "../camera";
import { BigTitle } from "../components/BigTitle";
import { SurveyInsert } from "../components/SurveyInsert";
import { clamp, easings, springProgress, stagger } from "../motion";
import { colors } from "../theme";

/** One idea: the graph is the interface. */
export const GraphInterface: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 16, durationInFrames - 30, 28);
  const jack = springProgress(frame, fps, 8, "premium");
  const planeSpread = springProgress(frame, fps, 12, "enter");
  const focusPull = interpolate(frame, [6, 60], [0.75, 0.35], {
    ...clamp,
    easing: easings.cinematic,
  });
  const planes = [0, 1, 2];
  const nodeX = interpolate(jack, [0, 1], [-420, -20]);
  const nodeY = interpolate(jack, [0, 1], [-180, -20]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: 1000,
            height: 480,
            perspective: 1600,
            transformStyle: "preserve-3d",
          }}
        >
          {planes.map((p) => {
            const delay = stagger(p, 5, 0);
            const local = interpolate(planeSpread, [delay * 0.02, 1], [0, 1], clamp);
            const z = (p - 1) * 90 * local;
            const y = (p - 1) * 48 * local;
            const depth = interpolate(p, [0, 2], [0.8, 0.3]);
            const blur = dofBlur(depth, focusPull, 4);
            return (
              <div
                key={p}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 900,
                  height: 360,
                  marginLeft: -450,
                  marginTop: -180,
                  borderRadius: 20,
                  border: `1px solid rgba(0,229,185,${0.16 + p * 0.1})`,
                  background: `linear-gradient(145deg, rgba(14,26,54,0.55), rgba(0,23,105,0.3))`,
                  backdropFilter: "blur(20px)",
                  boxShadow: `0 ${24 + p * 12}px ${60 + p * 20}px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
                  transform: `translateY(${y}px) translateZ(${z}px) rotateX(${14 - p * 3}deg) scale(${0.88 + p * 0.06})`,
                  opacity: interpolate(local, [0, 0.3], [0, 0.4 + p * 0.2], clamp),
                  filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundImage: `radial-gradient(circle at 35% 30%, #A8FFE8, ${colors.mint} 55%, #00B892)`,
            boxShadow: `0 0 0 ${6 + jack * 16}px rgba(0,229,185,0.2), 0 0 48px rgba(0,229,185,0.5)`,
            transform: `translate(${nodeX}px, ${nodeY}px) scale(${0.35 + jack * 0.65})`,
          }}
        />
      </AbsoluteFill>

      <BigTitle
        line="The graph is the interface."
        appearAt={50}
        disappearAt={200}
        size={64}
        voice="display"
        place="lower"
      />

      <SurveyInsert
        src="survey/the household example-selected-dark.png"
        appearAt={70}
        corner="tr"
        width={480}
        tilt={-10}
        tiltX={6}
        parallax={14}
        depth={0.35}
      />
    </AbsoluteFill>
  );
};
