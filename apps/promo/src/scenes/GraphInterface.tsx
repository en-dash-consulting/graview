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
import { clamp, easings, fadeIn, fadeOut, springProgress, stagger } from "../motion";
import { beats, colors, fonts } from "../theme";

const ACTIONS = ["open", "travel", "raise", "inspect"] as const;
const CAPTIONS = [
  { field: "status", value: "selected" },
  { field: "neighbours", value: "4 raised" },
  { field: "edge", value: "depends →" },
] as const;
const EDGE_LABELS = [
  { text: "owns", x: -300, y: -120 },
  { text: "routes", x: 270, y: -70 },
  { text: "covers", x: -40, y: 150 },
  { text: "units", x: 200, y: 120 },
] as const;

/**
 * One idea: the graph is the interface.
 * Center: readable Graview iso context-graph (not a featureless orb).
 * Periphery: UI plates bloom around it.
 */
export const GraphInterface: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localDur = beats.graph.duration;
  const opacity = beatOpacity(frame, 0, 22, localDur - 34, 32);

  const jack = springProgress(frame, fps, 4, "premium");
  const planeSpread = springProgress(frame, fps, 8, "enter");
  const focusPull = interpolate(frame, [4, 42], [0.75, 0.32], {
    ...clamp,
    easing: easings.cinematic,
  });

  const chipsIn = fadeIn(frame, 50, 14);
  const chipsOut = fadeOut(frame, localDur - 40, 22);
  const chipsOp = chipsIn * chipsOut;
  const captionsIn = fadeIn(frame, 68, 16);
  const captionsOut = fadeOut(frame, localDur - 36, 20);
  const captionsOp = captionsIn * captionsOut;
  const edgesIn = fadeIn(frame, 84, 16);
  const edgesOut = fadeOut(frame, localDur - 32, 18);
  const edgesOp = edgesIn * edgesOut;
  const neighbourRise = springProgress(frame, fps, 74, "snap");

  // Center iso crossfade: the household example → the coaching example mid-beat
  const centerA =
    fadeIn(frame, 10, 18) * fadeOut(frame, 78, 16);
  const centerB =
    fadeIn(frame, 72, 18) * fadeOut(frame, localDur - 16, 16);

  const planes = [0, 1, 2];

  const exitPush = interpolate(frame, [localDur - 42, localDur - 4], [0, 1], {
    ...clamp,
    easing: easings.softIn,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: 1000,
            height: 520,
            perspective: 1600,
            transformStyle: "preserve-3d",
            transform: `translateY(${exitPush * -18}px) scale(${1 + exitPush * 0.04})`,
          }}
        >
          {/* Soft glass depth rings — framing only, not the hero */}
          {planes.map((p) => {
            const delay = stagger(p, 4, 0);
            const local = interpolate(
              planeSpread,
              [delay * 0.02, 1],
              [0, 1],
              clamp,
            );
            const z = (p - 1) * 70 * local;
            const y = (p - 1) * 36 * local;
            const depth = interpolate(p, [0, 2], [0.8, 0.3]);
            const blur = dofBlur(depth, focusPull, 3.5);
            const raise =
              p === 1 ? neighbourRise * 12 : p === 2 ? neighbourRise * 6 : 0;
            return (
              <div
                key={p}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 760,
                  height: 420,
                  marginLeft: -380,
                  marginTop: -210,
                  borderRadius: 20,
                  border: `1px solid rgba(0,229,185,${0.1 + p * 0.06 + neighbourRise * 0.05})`,
                  background: `linear-gradient(145deg, rgba(14,26,54,0.22), rgba(0,23,105,0.12))`,
                  backdropFilter: "blur(10px)",
                  boxShadow: `0 ${16 + p * 8}px ${40 + p * 12}px rgba(0,0,0,0.28)`,
                  transform: `translateY(${y - raise}px) translateZ(${z + raise * 2}px) rotateX(${10 - p * 2}deg) scale(${0.92 + p * 0.04})`,
                  opacity: interpolate(
                    local,
                    [0, 0.3],
                    [0, 0.18 + p * 0.1],
                    clamp,
                  ) * jack,
                  filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Action chips — upper left of stage */}
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 8,
              display: "flex",
              gap: 10,
              opacity: chipsOp,
              transform: `translateY(${(1 - chipsIn) * 10}px)`,
              zIndex: 4,
            }}
          >
            {ACTIONS.map((a, i) => {
              const chip = springProgress(
                frame,
                fps,
                54 + stagger(i, 3),
                "snap",
              );
              return (
                <div
                  key={a}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background:
                      i === 0
                        ? "rgba(0,229,185,0.22)"
                        : "rgba(8,16,34,0.82)",
                    border: `1px solid rgba(0,229,185,${0.4 + i * 0.08})`,
                    fontFamily: fonts.mono,
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: 1.2,
                    color: colors.offWhite,
                    opacity: chip,
                    transform: `scale(${0.9 + chip * 0.1})`,
                    boxShadow:
                      i === 0
                        ? "0 0 18px rgba(0,229,185,0.28)"
                        : undefined,
                  }}
                >
                  {a}
                </div>
              );
            })}
          </div>

          {/* Captions — upper right */}
          <div
            style={{
              position: "absolute",
              right: 16,
              top: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              opacity: captionsOp,
              alignItems: "flex-end",
              zIndex: 4,
            }}
          >
            {CAPTIONS.map((c, i) => {
              const cin = springProgress(
                frame,
                fps,
                72 + stagger(i, 4),
                "enter",
              );
              return (
                <div
                  key={c.field}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    opacity: cin,
                    transform: `translateX(${(1 - cin) * 16}px)`,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "rgba(5,11,26,0.82)",
                    border: "1px solid rgba(0,229,185,0.32)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      letterSpacing: 1.4,
                      color: colors.offWhite,
                      opacity: 0.75,
                      textTransform: "uppercase",
                    }}
                  >
                    {c.field}
                  </span>
                  <span
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.mint,
                    }}
                  >
                    {c.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* High-contrast edge / kind labels around the center iso */}
          {EDGE_LABELS.map((e, i) => {
            const ein = springProgress(frame, fps, 86 + stagger(i, 5), "enter");
            return (
              <div
                key={e.text}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  marginLeft: e.x,
                  marginTop: e.y,
                  opacity: edgesOp * ein,
                  transform: `translateY(${(1 - ein) * 8}px)`,
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "rgba(5,11,26,0.88)",
                  border: "1px solid rgba(0,229,185,0.65)",
                  fontFamily: fonts.mono,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 1.6,
                  color: colors.white,
                  boxShadow:
                    "0 8px 28px rgba(0,0,0,0.5), 0 0 18px rgba(0,229,185,0.22)",
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                  zIndex: 5,
                }}
              >
                {e.text}
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: 40,
              bottom: 12,
              opacity: chipsOp * 0.95,
              fontFamily: fonts.mono,
              fontSize: 13,
              letterSpacing: 2,
              color: colors.mint,
              textTransform: "uppercase",
              textShadow: "0 4px 18px rgba(0,0,0,0.6)",
              zIndex: 4,
            }}
          >
            auto-derived · one model → surfaces
          </div>
        </div>
      </AbsoluteFill>

      {/* Center Graview iso — answers “what is this product view?” */}
      <AbsoluteFill style={{ opacity: centerA * jack, pointerEvents: "none" }}>
        <SurveyInsert
          src="survey/the household product-dark.png"
          appearAt={0}
          disappearAt={localDur}
          corner="center"
          width={680}
          tilt={-4}
          tiltX={3}
          parallax={0}
          depth={0.55}
          offsetY={-8}
          fadeInDur={1}
          fadeOutDur={1}
          label="the household example · graview"
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: centerB * jack, pointerEvents: "none" }}>
        <SurveyInsert
          src="survey/the coaching example-graview-dark.png"
          appearAt={0}
          disappearAt={localDur}
          corner="center"
          width={680}
          tilt={5}
          tiltX={3}
          parallax={0}
          depth={0.55}
          offsetY={-8}
          fadeInDur={1}
          fadeOutDur={1}
          label="the coaching example · graview"
        />
      </AbsoluteFill>

      {/* One primary line at a time — fixed size, crossfade (no shrink / stack) */}
      <BigTitle
        line="The graph is the interface."
        appearAt={22}
        disappearAt={78}
        size={56}
        voice="display"
        place="lower"
      />
      <BigTitle
        line="UI, nav, tools — from one model."
        appearAt={82}
        disappearAt={localDur - 22}
        size={52}
        voice="display"
        place="lower"
      />

      {/* Peripheral UI plates around the center iso */}
      <SurveyInsert
        src="survey/the household example-selected-dark.png"
        appearAt={46}
        disappearAt={localDur - 18}
        corner="tl"
        width={400}
        tilt={10}
        tiltX={5}
        parallax={10}
        depth={0.38}
        offsetY={8}
        label="the household example · selected"
      />
      <SurveyInsert
        src="survey/the coaching example-week-dark.png"
        appearAt={58}
        disappearAt={localDur - 14}
        corner="tr"
        width={420}
        tilt={-11}
        tiltX={6}
        parallax={12}
        depth={0.4}
        offsetY={-4}
        label="the coaching example · week"
      />
      <SurveyInsert
        src="survey/the coaching example-training-dark.png"
        appearAt={72}
        disappearAt={localDur - 12}
        corner="ml"
        width={360}
        tilt={12}
        tiltX={4}
        parallax={8}
        depth={0.34}
        offsetY={48}
        label="drill · training"
      />
      <SurveyInsert
        src="survey/the household example-travelled-dark.png"
        appearAt={86}
        disappearAt={localDur - 10}
        corner="mr"
        width={380}
        tilt={-10}
        tiltX={5}
        parallax={11}
        depth={0.36}
        offsetY={-12}
        label="the household example · travel"
      />
      <SurveyInsert
        src="survey/proposal-graview-dark.png"
        appearAt={98}
        disappearAt={localDur - 8}
        corner="br"
        width={440}
        tilt={-7}
        tiltX={4}
        parallax={14}
        depth={0.42}
        offsetX={-24}
        offsetY={-8}
        label="proposal · graview"
      />
    </AbsoluteFill>
  );
};
