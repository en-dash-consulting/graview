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
  { label: "Plot", x: 220, y: 300 },
  { label: "Person", x: 820, y: 270 },
  { label: "Rule", x: 250, y: 740 },
  { label: "Action", x: 800, y: 770 },
] as const;

const EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [0, 3],
];

/**
 * Magic first — ~4.5s. Chips land slowly, edges draw, plate fully settles,
 * THEN caption “One declaration.” with room to breathe.
 */
export const MagicHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = feedBeats.magic.duration;

  const exit = interpolate(frame, [dur - 16, dur], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });
  const flash = interpolate(frame, [0, 5, 18], [0.18, 0.05, 0], clamp);

  // Plate after chips + edges have settled (~1.8s in)
  const plateEnter = springProgress(frame, fps, 52, "settle");
  const plateOpacity = interpolate(frame, [52, 68], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const plateScale = interpolate(plateEnter, [0, 1], [0.96, 1]);
  const plateDrift = interpolate(frame, [68, dur], [1, 1.025], clamp);

  // Caption only after plate has fully settled (~3.1s)
  const caption = springProgress(frame, fps, 92, "enter");
  const captionOut = interpolate(frame, [dur - 20, dur - 8], [1, 0], clamp);

  const zoomCross = interpolate(frame, [100, 118], [0, 1], {
    ...clamp,
    easing: easings.cross,
  });

  const chipFade = interpolate(frame, [58, 78], [1, 0.3], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.field,
        opacity: exit,
        overflow: "hidden",
      }}
    >
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
            "radial-gradient(circle at 50% 42%, rgba(0,229,185,0.12) 0%, transparent 45%)",
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

      <svg
        width={1080}
        height={1080}
        style={{ position: "absolute", inset: 0, opacity: 0.4 }}
      >
        {Array.from({ length: 20 }, (_, i) => {
          const seed = (i * 47) % 97;
          const x = 80 + ((seed * 37) % 920);
          const y = 80 + ((seed * 53) % 920);
          const o =
            0.12 +
            0.28 * (0.5 + 0.5 * Math.sin(frame * 0.05 + i * 0.7));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.4 + (i % 3) * 0.6}
              fill={colors.mint}
              fillOpacity={o}
            />
          );
        })}
      </svg>

      <svg
        width={1080}
        height={1080}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: chipFade,
        }}
      >
        {EDGES.map(([a, b], i) => {
          const na = NODES[a]!;
          const nb = NODES[b]!;
          // Edges after chips start landing — unhurried draw
          const draw = springProgress(frame, fps, 22 + i * 7, "enter");
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
              strokeOpacity={0.5 * draw}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - draw)}
            />
          );
        })}
      </svg>

      {NODES.map((node, i) => {
        // ~8–9f between chips — no rushed stagger
        const enter = springProgress(frame, fps, 6 + i * 9, "enter");
        const scale = interpolate(enter, [0, 1], [0.94, 1]);
        return (
          <div
            key={node.label}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: enter * chipFade,
              padding: "14px 26px",
              borderRadius: 999,
              backgroundColor: colors.fieldElevated,
              border: `1.5px solid rgba(0,229,185,0.5)`,
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,229,185,0.15)",
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

      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side + 20,
          right: FEED_SAFE.side + 20,
          top: "50%",
          height: 540,
          marginTop: -270,
          opacity: plateOpacity,
          transform: `scale(${plateScale})`,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "rgba(14,26,54,0.85)",
          border: `2px solid rgba(0,229,185,0.5)`,
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,229,185,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
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
              transform: `scale(${2.05 * plateDrift})`,
              transformOrigin: "50% 42%",
              filter: "brightness(1.15) contrast(1.08)",
              opacity: 1 - zoomCross,
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
              transform: `scale(${2.15 * plateDrift})`,
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

      <div
        style={{
          position: "absolute",
          left: FEED_SAFE.side,
          right: FEED_SAFE.side,
          bottom: FEED_SAFE.bottom + 36,
          textAlign: "center",
          opacity: caption * captionOut,
          transform: `translateY(${(1 - caption) * 10}px)`,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: -0.3,
          color: colors.offWhite,
          textShadow: "0 8px 28px rgba(0,0,0,0.7)",
        }}
      >
        One declaration.
      </div>

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
