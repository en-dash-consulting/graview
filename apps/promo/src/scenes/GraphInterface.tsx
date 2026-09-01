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
  { text: "owns", x: -280, y: -90 },
  { text: "routes", x: 250, y: -40 },
  { text: "covers", x: -60, y: 130 },
] as const;

/**
 * One idea: the graph is the interface.
 * Interfaces bloom around the graph in different corners —
 * not a slideshow replacing one top-right slot.
 */
export const GraphInterface: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localDur = beats.graph.duration;
  // Softer overlap into/out of neighbouring beats
  const opacity = beatOpacity(frame, 0, 22, localDur - 34, 32);

  // Act 1 — jack-in
  const jack = springProgress(frame, fps, 4, "premium");
  const planeSpread = springProgress(frame, fps, 8, "enter");
  const focusPull = interpolate(frame, [4, 42], [0.75, 0.32], {
    ...clamp,
    easing: easings.cinematic,
  });

  // Act 2 candy windows
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

  const planes = [0, 1, 2];
  const nodeX = interpolate(jack, [0, 1], [-420, -20]);
  const nodeY = interpolate(jack, [0, 1], [-180, -20]);

  // Exit energy — slight plane push toward city
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
            height: 480,
            perspective: 1600,
            transformStyle: "preserve-3d",
            transform: `translateY(${exitPush * -18}px) scale(${1 + exitPush * 0.04})`,
          }}
        >
          {planes.map((p) => {
            const delay = stagger(p, 4, 0);
            const local = interpolate(
              planeSpread,
              [delay * 0.02, 1],
              [0, 1],
              clamp,
            );
            const z = (p - 1) * 90 * local;
            const y = (p - 1) * 48 * local;
            const depth = interpolate(p, [0, 2], [0.8, 0.3]);
            const blur = dofBlur(depth, focusPull, 4);
            const raise =
              p === 1 ? neighbourRise * 18 : p === 2 ? neighbourRise * 8 : 0;
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
                  border: `1px solid rgba(0,229,185,${0.16 + p * 0.1 + neighbourRise * 0.08})`,
                  background: `linear-gradient(145deg, rgba(14,26,54,0.55), rgba(0,23,105,0.3))`,
                  backdropFilter: "blur(20px)",
                  boxShadow: `0 ${24 + p * 12}px ${60 + p * 20}px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
                  transform: `translateY(${y - raise}px) translateZ(${z + raise * 2}px) rotateX(${14 - p * 3}deg) scale(${0.88 + p * 0.06})`,
                  opacity: interpolate(
                    local,
                    [0, 0.3],
                    [0, 0.42 + p * 0.22],
                    clamp,
                  ),
                  filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
                  overflow: "hidden",
                }}
              >
                {p === 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 36,
                      top: 28,
                      display: "flex",
                      gap: 10,
                      opacity: chipsOp,
                      transform: `translateY(${(1 - chipsIn) * 10}px)`,
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
                                : "rgba(8,16,34,0.75)",
                            border: `1px solid rgba(0,229,185,${0.35 + i * 0.08})`,
                            fontFamily: fonts.mono,
                            fontSize: 15,
                            fontWeight: 500,
                            letterSpacing: 1.2,
                            color: colors.offWhite,
                            opacity: chip,
                            transform: `scale(${0.86 + chip * 0.14})`,
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
                ) : null}

                {p === 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      right: 36,
                      top: 32,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      opacity: captionsOp,
                      alignItems: "flex-end",
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
                            background: "rgba(5,11,26,0.72)",
                            border: "1px solid rgba(0,229,185,0.22)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: fonts.mono,
                              fontSize: 12,
                              letterSpacing: 1.4,
                              color: colors.muted,
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
                ) : null}

                {p === 2 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 40,
                      bottom: 28,
                      opacity: chipsOp * 0.95,
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      letterSpacing: 2,
                      color: colors.mint,
                      textTransform: "uppercase",
                      textShadow: "0 4px 18px rgba(0,0,0,0.6)",
                    }}
                  >
                    auto-derived · one model → surfaces
                  </div>
                ) : null}
              </div>
            );
          })}

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
                  transform: `scale(${0.9 + ein * 0.1})`,
                  padding: "5px 11px",
                  borderRadius: 999,
                  background: "rgba(0,23,105,0.7)",
                  border: "1px solid rgba(0,229,185,0.4)",
                  fontFamily: fonts.mono,
                  fontSize: 13,
                  letterSpacing: 1.5,
                  color: colors.offWhite,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                {e.text}
              </div>
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
            transform: `translate(${nodeX}px, ${nodeY + exitPush * -12}px) scale(${0.35 + jack * 0.65})`,
          }}
        />
      </AbsoluteFill>

      {/* Title docks lower so blooming plates keep the mid/upper stage clear */}
      <BigTitle
        line="The graph is the interface."
        appearAt={28}
        dockAt={72}
        disappearAt={110}
        size={56}
        voice="display"
        place="lower"
      />
      <BigTitle
        line="UI, nav, tools — from one model."
        appearAt={95}
        disappearAt={localDur - 26}
        size={36}
        voice="literary"
        place="lower"
      />

      {/*
        Interfaces bloom around the graph — staggered corners/edges,
        diverse the household example / the coaching example lenses, overlapping lifetimes (not one TR slot).
      */}
      <SurveyInsert
        src="survey/the household example-selected-dark.png"
        appearAt={46}
        disappearAt={localDur - 18}
        corner="tl"
        width={440}
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
        width={460}
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
        width={400}
        tilt={12}
        tiltX={4}
        parallax={8}
        depth={0.34}
        offsetY={36}
        label="drill · training"
      />
      <SurveyInsert
        src="survey/the household example-travelled-dark.png"
        appearAt={86}
        disappearAt={localDur - 10}
        corner="mr"
        width={420}
        tilt={-10}
        tiltX={5}
        parallax={11}
        depth={0.36}
        offsetY={-20}
        label="the household example · travel"
      />
      <SurveyInsert
        src="survey/the household example-raised-dark.png"
        appearAt={98}
        disappearAt={localDur - 8}
        corner="br"
        width={480}
        tilt={-7}
        tiltX={4}
        parallax={14}
        depth={0.42}
        offsetX={-24}
        offsetY={-8}
        label="raised · select"
      />
    </AbsoluteFill>
  );
};
