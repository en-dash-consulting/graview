import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE, feedBeats } from "../feedTheme";

const NODES = [
  { label: "Plot", x: 220, y: 320 },
  { label: "Person", x: 820, y: 280 },
  { label: "Rule", x: 260, y: 720 },
  { label: "Action", x: 800, y: 760 },
] as const;

const EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [0, 3],
  [1, 2],
];

/**
 * Magic first — typed chips snap, mint edges connect, glass UI erupts from the graph.
 * No pain slogan. Optional micro-caption: "One declaration."
 */
export const MagicHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.magic.duration;

  const exit = interpolate(frame, [dur - 8, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const flash = interpolate(frame, [0, 3, 9], [0.4, 0.12, 0], clamp);

  const plateEnter = springProgress(frame, fps, 28, "premium");
  const plateScale = interpolate(plateEnter, [0, 1], [0.55, 1]);
  const plateY = interpolate(plateEnter, [0, 1], [80, 0]);
  const plateRotate = interpolate(plateEnter, [0, 1], [4, -1.2]);

  const caption = springProgress(frame, fps, 36, "snap");
  const captionOut = interpolate(frame, [dur - 12, dur - 4], [1, 0], clamp);

  // Crossfade graph → zoomed punch near end of hook
  const zoomCross = interpolate(frame, [42, 52], [0, 1], {
    ...clamp,
    easing: easings.cross,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.field,
        opacity: exit,
        overflow: "hidden",
      }}
    >
      {/* Navy wash + mint bloom */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,23,105,0.7) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(0,229,185,0.14) 0%, transparent 45%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: colors.mint,
          opacity: flash,
          pointerEvents: "none",
        }}
      />

      {/* Soft constellation dots behind chips */}
      <svg
        width={1080}
        height={1080}
        style={{ position: "absolute", inset: 0, opacity: 0.55 }}
      >
        {Array.from({ length: 28 }, (_, i) => {
          const seed = (i * 47) % 97;
          const x = 80 + ((seed * 37) % 920);
          const y = 80 + ((seed * 53) % 920);
          const o =
            0.15 +
            0.35 * (0.5 + 0.5 * Math.sin(frame * 0.08 + i * 0.7));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.5 + (i % 3)}
              fill={colors.mint}
              fillOpacity={o}
            />
          );
        })}
      </svg>

      {/* Mint edges — draw on as chips land */}
      <svg
        width={1080}
        height={1080}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {EDGES.map(([a, b], i) => {
          const na = NODES[a]!;
          const nb = NODES[b]!;
          const draw = springProgress(frame, fps, 10 + i * 3, "snap");
          const len = Math.hypot(nb.x - na.x, nb.y - na.y);
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={colors.mint}
              strokeWidth={2}
              strokeOpacity={0.55 * draw}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - draw)}
            />
          );
        })}
      </svg>

      {/* Typed node chips */}
      {NODES.map((node, i) => {
        const enter = springProgress(frame, fps, 2 + i * 4, "snap");
        const scale = interpolate(enter, [0, 1], [0.7, 1]);
        return (
          <div
            key={node.label}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: enter,
              padding: "14px 26px",
              borderRadius: 999,
              backgroundColor: colors.fieldElevated,
              border: `1.5px solid rgba(0,229,185,0.55)`,
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.45), 0 0 24px rgba(0,229,185,0.2)",
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 28,
              color: colors.mint,
              letterSpacing: 0.6,
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </div>
        );
      })}

      {/* Glass UI plate erupting from center */}
      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side + 20,
          right: FEED_SAFE.side + 20,
          top: "50%",
          height: 520,
          marginTop: -260,
          opacity: plateEnter,
          transform: `translateY(${plateY}px) scale(${plateScale}) rotate(${plateRotate}deg)`,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "rgba(14,26,54,0.85)",
          border: `2px solid rgba(0,229,185,0.5)`,
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,185,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: colors.fieldElevated,
          }}
        >
          <Img
            src={staticFile("survey/todo-graview-dark.png")}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 42%",
              transform: "scale(1.85)",
              transformOrigin: "50% 42%",
              filter: "brightness(1.15) contrast(1.08)",
              opacity: 1 - zoomCross * 0.15,
            }}
          />
          <Img
            src={staticFile("survey/todo-zoomed-dark.png")}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "48% 40%",
              transform: `scale(${1.9 + zoomCross * 0.15})`,
              transformOrigin: "48% 40%",
              filter: "brightness(1.18) contrast(1.1)",
              opacity: zoomCross,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(232,238,248,0.06) 0%, transparent 30%, transparent 70%, rgba(5,11,26,0.3) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Micro caption */}
      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 28,
          textAlign: "center",
          opacity: caption * captionOut,
          transform: `translateY(${(1 - caption) * 20}px)`,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: -0.3,
          color: colors.offWhite,
          textShadow: "0 8px 28px rgba(0,0,0,0.7)",
        }}
      >
        One declaration.
      </div>

      {/* Light vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
