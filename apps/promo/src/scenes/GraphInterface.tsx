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
 * 3-act micro-sequence inside one beat:
 * 1) Jack-in + planes assemble
 * 2) Brief title, then derived affordances + survey candy
 * 3) Exit into city still hot
 */
export const GraphInterface: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localDur = beats.graph.duration;
  const opacity = beatOpacity(frame, 0, 14, localDur - 22, 20);

  // Act 1 — jack-in
  const jack = springProgress(frame, fps, 4, "premium");
  const planeSpread = springProgress(frame, fps, 8, "enter");
  const focusPull = interpolate(frame, [4, 42], [0.75, 0.32], {
    ...clamp,
    easing: easings.cinematic,
  });

  // Act 2 candy windows
  const chipsIn = fadeIn(frame, 55, 12);
  const chipsOut = fadeOut(frame, localDur - 34, 18);
  const chipsOp = chipsIn * chipsOut;
  const captionsIn = fadeIn(frame, 72, 14);
  const captionsOut = fadeOut(frame, localDur - 30, 16);
  const captionsOp = captionsIn * captionsOut;
  const edgesIn = fadeIn(frame, 88, 14);
  const edgesOut = fadeOut(frame, localDur - 26, 14);
  const edgesOp = edgesIn * edgesOut;
  const neighbourRise = springProgress(frame, fps, 78, "snap");

  const planes = [0, 1, 2];
  const nodeX = interpolate(jack, [0, 1], [-420, -20]);
  const nodeY = interpolate(jack, [0, 1], [-180, -20]);

  // Exit energy — slight plane push toward city
  const exitPush = interpolate(frame, [localDur - 36, localDur - 4], [0, 1], {
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
                {/* Action chips — derived affordances on mid plane */}
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
                        58 + stagger(i, 3),
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

                {/* Field captions from schema */}
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
                        76 + stagger(i, 4),
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

                {/* Soft “actions derived” plate label on front plane */}
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
                    actions derived · schema → UI
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Edge labels floating in the stack */}
          {EDGE_LABELS.map((e, i) => {
            const ein = springProgress(frame, fps, 90 + stagger(i, 5), "enter");
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

      {/* Act 2 — title hits ~1.6s alone, then docks while candy continues */}
      <BigTitle
        line="The graph is the interface."
        appearAt={36}
        dockAt={82}
        disappearAt={localDur - 22}
        size={60}
        voice="display"
        place="lower"
      />

      {/* Bigger, staged survey inserts — selected → raised → travelled */}
      <SurveyInsert
        src="survey/the household example-selected-dark.png"
        appearAt={58}
        disappearAt={100}
        corner="tr"
        width={560}
        tilt={-9}
        tiltX={5}
        parallax={12}
        depth={0.4}
        label="selected"
      />
      <SurveyInsert
        src="survey/the household example-raised-dark.png"
        appearAt={92}
        disappearAt={130}
        corner="tr"
        width={580}
        tilt={-7}
        tiltX={6}
        parallax={14}
        depth={0.42}
        label="raised"
      />
      <SurveyInsert
        src="survey/the household example-travelled-dark.png"
        appearAt={124}
        disappearAt={localDur - 8}
        corner="tr"
        width={600}
        tilt={-6}
        tiltX={5}
        parallax={16}
        depth={0.45}
        label="travelled"
      />
    </AbsoluteFill>
  );
};
