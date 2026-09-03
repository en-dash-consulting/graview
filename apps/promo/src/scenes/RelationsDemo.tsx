import React, { useMemo } from "react";
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
import { SurveyInsert } from "../components/SurveyInsert";
import {
  clamp,
  fadeIn,
  fadeOut,
  springProgress,
  stagger,
} from "../motion";
import { beats, colors, fonts } from "../theme";

type Entity = {
  id: string;
  label: string;
  kind: "Person" | "Event" | "Step" | "Part";
  x: number;
  y: number;
};

const ENTITIES: Entity[] = [
  { id: "person", label: "Person", kind: "Person", x: -300, y: -70 },
  { id: "event", label: "Event", kind: "Event", x: -40, y: -130 },
  { id: "step", label: "Step", kind: "Step", x: 220, y: -40 },
  { id: "part", label: "Part", kind: "Part", x: 120, y: 110 },
];

const EDGES: { from: string; to: string; label: string }[] = [
  { from: "person", to: "event", label: "attends" },
  { from: "event", to: "step", label: "requires" },
  { from: "step", to: "part", label: "uses" },
];

const KIND_COLOR: Record<Entity["kind"], string> = {
  Person: "#7C9CFF",
  Event: colors.mint,
  Step: "#FFB86B",
  Part: "#E0A0FF",
};

const STEPS = [
  { id: 1, label: "Shut down unit", tool: null },
  { id: 2, label: "Replace filter", tool: "HEPA cartridge", highlight: true },
  { id: 3, label: "Torque housing", tool: "Torque wrench" },
  { id: 4, label: "Verify airflow", tool: null },
] as const;

/**
 * Mid-story teach (~15s): ONE typed graph → MANY derived surfaces.
 * Act A — declare entities (Person, Event, Step, Part) + edges.
 * Act B — calendar · instructions/procedure · agent tools bloom together.
 */
export const RelationsDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = beats.relations.duration;
  const opacity = beatOpacity(frame, 0, 22, dur - 40, 36);

  // Local timeline (~450f):
  // 0–130   schema graph blooms
  // 110–end surfaces bloom (calendar + procedure + agent rail)
  // 180–320 step ↔ part highlight punch
  const schemaOut = fadeOut(frame, 118, 28);
  const schemaOp = fadeIn(frame, 4, 16) * schemaOut;

  const surfacesIn = springProgress(frame, fps, 115, "enter");
  const surfacesOp =
    fadeIn(frame, 115, 22) * fadeOut(frame, dur - 42, 30);

  const stepPulse =
    0.72 + 0.28 * Math.sin(Math.max(0, frame - 190) * 0.18);
  const partLinkOp =
    fadeIn(frame, 185, 16) * fadeOut(frame, 340, 24);
  const partLinkIn = springProgress(frame, fps, 190, "premium");

  const agentOp =
    fadeIn(frame, 155, 18) * fadeOut(frame, dur - 48, 26);

  const entityById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of ENTITIES) m.set(e.id, e);
    return m;
  }, []);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* --- Act A: declare the graph --- */}
      {schemaOp > 0.02 ? (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: schemaOp,
          transform: `scale(${0.94 + springProgress(frame, fps, 6, "enter") * 0.06}) translateY(${interpolate(frame, [110, 145], [0, -56], clamp)}px)`,
        }}
      >
        <svg
          width={980}
          height={460}
          style={{ position: "absolute", overflow: "visible" }}
        >
          {EDGES.map((edge, i) => {
            const a = entityById.get(edge.from)!;
            const b = entityById.get(edge.to)!;
            const t = springProgress(frame, fps, 26 + stagger(i, 6), "enter");
            const x1 = 490 + a.x;
            const y1 = 220 + a.y;
            const x2 = 490 + b.x;
            const y2 = 220 + b.y;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g key={edge.label} opacity={t}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x1 + (x2 - x1) * t}
                  y2={y1 + (y2 - y1) * t}
                  stroke="rgba(0,229,185,0.55)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <text
                  x={mx}
                  y={my - 10}
                  textAnchor="middle"
                  fill={colors.offWhite}
                  fontFamily={fonts.mono}
                  fontSize={13}
                  letterSpacing={1.5}
                  opacity={t * 0.9}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {ENTITIES.map((e, i) => {
          const t = springProgress(frame, fps, 10 + stagger(i, 5), "snap");
          const accent = KIND_COLOR[e.kind];
          return (
            <div
              key={e.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                marginLeft: e.x - 72,
                marginTop: e.y - 34,
                width: 144,
                opacity: t,
                transform: `scale(${0.82 + t * 0.18})`,
                padding: "14px 16px",
                borderRadius: 16,
                background: "rgba(8,16,34,0.9)",
                border: `1.5px solid ${accent}`,
                boxShadow: `0 20px 50px rgba(0,0,0,0.45), 0 0 28px ${accent}33`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: 2,
                  color: accent,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                entity
              </div>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: 24,
                  fontWeight: 700,
                  color: colors.white,
                }}
              >
                {e.label}
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            // Upper third under open-brand area; hide once mid-story titles take over
            opacity:
              fadeIn(frame, 36, 10) *
              schemaOut *
              fadeOut(frame, 100, 12),
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(0,229,185,0.14)",
            border: "1px solid rgba(0,229,185,0.45)",
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: 1.8,
            color: colors.offWhite,
            textTransform: "uppercase",
            zIndex: 2,
          }}
        >
          typed context graph
        </div>
      </AbsoluteFill>
      ) : null}

      {/* --- Act B: surfaces bloom from the same graph --- */}
      <AbsoluteFill
        style={{
          opacity: surfacesOp,
          pointerEvents: "none",
        }}
      >
        {/* Center Graview iso — fills empty middle behind floating panels */}
        <div
          style={{
            position: "absolute",
            left: "42%",
            top: "48%",
            width: 760,
            marginLeft: -380,
            marginTop: -220,
            opacity: 0.7 + surfacesIn * 0.3,
            transform: `translateY(${(1 - surfacesIn) * 18}px) scale(${0.94 + surfacesIn * 0.06})`,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(0,229,185,0.42)",
            boxShadow:
              "0 32px 90px rgba(0,0,0,0.65), 0 0 48px rgba(0,229,185,0.16)",
            background: "#0A1428",
            zIndex: 0,
          }}
        >
          <Img
            src={staticFile(
              frame < 250
                ? "survey/todo-graview-dark.png"
                : "survey/todo-zoomed-dark.png",
            )}
            style={{
              width: "100%",
              display: "block",
              filter: "saturate(1.05) contrast(1.08) brightness(1.02)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 12,
              padding: "3px 8px",
              borderRadius: 4,
              background: "rgba(5,11,26,0.82)",
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: 1.4,
              color: colors.offWhite,
              textTransform: "uppercase",
            }}
          >
            graview · context graph
          </div>
        </div>

        {/* 1. Calendar / week — smaller, left */}
        <div
          style={{
            position: "absolute",
            left: 48,
            top: 88,
            width: 480,
            opacity: 0.4 + surfacesIn * 0.6,
            transform: `translateY(${(1 - surfacesIn) * 28}px) scale(${0.9 + surfacesIn * 0.1}) translateZ(20px)`,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(124,156,255,0.4)",
            boxShadow:
              "0 28px 70px rgba(0,0,0,0.5), 0 0 36px rgba(124,156,255,0.12)",
            background: "#0A1428",
            zIndex: 5,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid rgba(124,156,255,0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(8,16,34,0.92)",
            }}
          >
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                letterSpacing: 1.6,
                color: "#7C9CFF",
                textTransform: "uppercase",
              }}
            >
              calendar · week
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                color: colors.muted,
              }}
            >
              People · Events
            </span>
          </div>
          <Img
            src={staticFile("survey/todo-week-dark.png")}
            style={{ width: "100%", display: "block" }}
          />
        </div>

        {/* 2. Instructions / procedure — right hero (clears center iso) */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 64,
            width: 560,
            opacity: 0.35 + surfacesIn * 0.65,
            transform: `translateX(${(1 - surfacesIn) * 40}px) scale(${0.9 + surfacesIn * 0.1}) translateZ(48px)`,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,184,107,0.45)",
            boxShadow:
              "0 36px 90px rgba(0,0,0,0.55), 0 0 44px rgba(255,184,107,0.12)",
            background: "#080F22",
            display: "flex",
            flexDirection: "column",
            zIndex: 6,
            isolation: "isolate",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,184,107,0.28)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                letterSpacing: 1.8,
                color: "#FFB86B",
                textTransform: "uppercase",
              }}
            >
              instructions · procedure
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                color: colors.muted,
              }}
            >
              Step · Part · Tool
            </span>
          </div>

          <div style={{ display: "flex", minHeight: 320 }}>
            {/* Step list */}
            <div
              style={{
                flex: 1.15,
                padding: "14px 14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderRight: "1px solid rgba(255,184,107,0.18)",
              }}
            >
              {STEPS.map((s, i) => {
                const rowIn = springProgress(
                  frame,
                  fps,
                  130 + stagger(i, 4),
                  "snap",
                );
                const isHi = Boolean(
                  "highlight" in s && s.highlight && partLinkOp > 0.05,
                );
                return (
                  <div
                    key={s.id}
                    style={{
                      opacity: rowIn,
                      transform: `translateX(${(1 - rowIn) * 12}px)`,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: isHi
                        ? `rgba(40,28,16,${0.92 + stepPulse * 0.08})`
                        : "#050B1A",
                      border: isHi
                        ? `1.5px solid rgba(255,184,107,${0.55 + stepPulse * 0.35})`
                        : "1px solid rgba(255,184,107,0.2)",
                      boxShadow: isHi
                        ? `0 0 ${18 * stepPulse}px rgba(255,184,107,0.35)`
                        : undefined,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: isHi
                          ? "rgba(255,184,107,0.28)"
                          : "rgba(0,229,185,0.12)",
                        border: `1px solid ${isHi ? "#FFB86B" : "rgba(0,229,185,0.35)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: fonts.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        color: isHi ? "#FFB86B" : colors.mint,
                      }}
                    >
                      {s.id}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: fonts.display,
                          fontSize: 17,
                          fontWeight: 600,
                          color: colors.white,
                        }}
                      >
                        {s.label}
                      </div>
                      {s.tool ? (
                        <div
                          style={{
                            marginTop: 2,
                            fontFamily: fonts.mono,
                            fontSize: 11,
                            letterSpacing: 1,
                            color: isHi ? "#E0A0FF" : colors.muted,
                            textTransform: "uppercase",
                          }}
                        >
                          uses · {s.tool}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Linked part / tool panel */}
            <div
              style={{
                flex: 0.95,
                padding: 16,
                opacity: Math.max(0.35, partLinkOp),
                transform: `translateX(${(1 - partLinkIn) * 24}px)`,
                background: "#050B1A",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "#E0A0FF",
                  textTransform: "uppercase",
                }}
              >
                linked part
              </div>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  fontWeight: 700,
                  color: colors.white,
                  lineHeight: 1.15,
                }}
              >
                HEPA cartridge
              </div>
              <div
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  color: colors.offWhite,
                  opacity: 0.85,
                }}
              >
                Step 2 · Replace filter
              </div>
              <div
                style={{
                  marginTop: 4,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(8,16,34,0.85)",
                  border: "1px solid rgba(224,160,255,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  { k: "edge", v: "Step uses Part" },
                  { k: "sku", v: "HF-14 · stocked" },
                  { k: "also", v: "Torque wrench" },
                ].map((row) => (
                  <div
                    key={row.k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        color: colors.muted,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.k}
                    </span>
                    <span
                      style={{
                        fontFamily: fonts.display,
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.mint,
                      }}
                    >
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mini survey still — procedure chrome */}
              <div
                style={{
                  marginTop: "auto",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid rgba(0,229,185,0.28)",
                  opacity: fadeIn(frame, 210, 16),
                }}
              >
                <Img
                  src={staticFile("survey/todo-tidied-dark.png")}
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Agent / activity rail — above title band */}
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 210,
            width: 560,
            opacity:
              agentOp *
              (frame >= 100 && frame <= 210
                ? interpolate(frame, [100, 108, 195, 210], [1, 0.15, 0.15, 1], clamp)
                : frame >= 200 && frame <= 320
                  ? interpolate(frame, [200, 208, 300, 318], [1, 0.12, 0.12, 1], clamp)
                  : frame >= 310
                    ? interpolate(frame, [310, 320], [1, 0.2], clamp)
                    : 1),
            transform: `translateY(${(1 - springProgress(frame, fps, 155, "enter")) * 20}px)`,
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(5,14,28,0.96)",
            border: "1px solid rgba(0,229,185,0.48)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.42)",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: 2,
              color: colors.mint,
              textTransform: "uppercase",
            }}
          >
            agent tools · same graph
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              "schedule with Alex",
              "pull HEPA cartridge",
              "open Replace filter",
            ].map((chip, i) => {
              const cin = springProgress(
                frame,
                fps,
                168 + stagger(i, 5),
                "snap",
              );
              return (
                <div
                  key={chip}
                  style={{
                    opacity: cin,
                    transform: `scale(${0.9 + cin * 0.1})`,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background:
                      i === 1
                        ? "rgba(224,160,255,0.18)"
                        : "rgba(8,16,34,0.75)",
                    border: `1px solid ${
                      i === 1
                        ? "rgba(224,160,255,0.5)"
                        : "rgba(0,229,185,0.35)"
                    }`,
                    fontFamily: fonts.display,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.white,
                  }}
                >
                  {chip}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>

      <BigTitle
        line="Entities + relationships."
        appearAt={12}
        disappearAt={100}
        size={52}
        voice="display"
        place="lower"
      />
      <BigTitle
        line="Calendar · instructions · tools — same graph."
        appearAt={108}
        disappearAt={200}
        size={48}
        voice="display"
        place="lower"
      />
      <BigTitle
        line="A step linked to its part."
        appearAt={205}
        disappearAt={310}
        size={46}
        voice="display"
        place="lower"
      />
      <BigTitle
        line="AI-ready from the same graph."
        appearAt={318}
        disappearAt={dur - 40}
        size={46}
        voice="display"
        place="lower"
      />

      <SurveyInsert
        src="survey/todo-lists-dark.png"
        label="drill · procedure"
        appearAt={155}
        disappearAt={290}
        corner="br"
        width={360}
        tilt={-9}
        tiltX={3}
        parallax={8}
        depth={0.32}
        offsetY={-12}
        offsetX={-16}
      />
      <SurveyInsert
        src="survey/todo-tidied-dark.png"
        label="activity · tools"
        appearAt={300}
        disappearAt={dur - 36}
        corner="bl"
        width={400}
        tilt={8}
        tiltX={-3}
        parallax={10}
        depth={0.36}
        offsetY={-4}
      />
      <SurveyInsert
        src="survey/todo-selected-dark.png"
        label="selected · raised"
        appearAt={250}
        disappearAt={dur - 32}
        corner="tc"
        width={340}
        tilt={6}
        tiltX={4}
        parallax={6}
        depth={0.28}
        offsetY={8}
      />
    </AbsoluteFill>
  );
};
