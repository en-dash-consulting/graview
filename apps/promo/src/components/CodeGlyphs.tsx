import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easings, springProgress } from "../motion";
import { colors, fonts } from "../theme";

const SNIPPET = `defineApp({
  domain: "commerce",
  entities: ["Order", "Customer"],
  graph: true,
})`;

const ORBIT_GLYPHS = [
  "entity",
  "edge",
  "node",
  "schema",
  "tool",
  "seat",
  "view",
  "declare",
  "→",
  "type",
  "fn",
  "::",
];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  fadeOut?: number;
  shatter?: number;
};

/** Typewriter defineApp block + orbiting glyphs that shatter into constellation. */
export const CodeGlyphs: React.FC<Props> = ({
  fadeOut = 1,
  shatter = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ease typing so it doesn't feel linear / machine-gun
  const typeProgress = interpolate(frame, [6, 82], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const typed = Math.min(
    SNIPPET.length,
    Math.floor(typeProgress * SNIPPET.length),
  );
  const text = SNIPPET.slice(0, typed);
  const stillTyping = typed < SNIPPET.length;
  const cursorOn = stillTyping && Math.floor(frame / 9) % 2 === 0;

  const orbits = useMemo(() => {
    const rand = mulberry32(11);
    return Array.from({ length: 16 }, (_, i) => ({
      text: ORBIT_GLYPHS[i % ORBIT_GLYPHS.length]!,
      angle: (i / 16) * Math.PI * 2 + rand() * 0.2,
      radius: 280 + rand() * 220,
      delay: 38 + Math.floor(rand() * 48),
      size: 15 + Math.floor(rand() * 10),
      mint: rand() > 0.55,
    }));
  }, []);

  const plateIn = springProgress(frame, fps, 0, "enter");
  const blockOpacity =
    plateIn *
    interpolate(shatter, [0, 1], [1, 0], clamp) *
    fadeOut;

  const blockBlur = interpolate(shatter, [0, 1], [0, 14], clamp);
  const blockScale = interpolate(shatter, [0, 1], [1, 1.06], {
    ...clamp,
    easing: easings.softIn,
  });

  const defineLen = "defineApp".length;
  const head = text.slice(0, Math.min(defineLen, text.length));
  const tail = text.length > defineLen ? text.slice(defineLen) : "";

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: blockOpacity,
          filter: `blur(${blockBlur}px)`,
          transform: `scale(${blockScale * (0.96 + plateIn * 0.04)})`,
        }}
      >
        <div
          style={{
            padding: "36px 44px",
            borderRadius: 16,
            background: "rgba(10,20,40,0.74)",
            border: "1px solid rgba(0,229,185,0.24)",
            boxShadow: `
              0 30px 80px rgba(0,0,0,0.48),
              0 0 40px rgba(0,229,185,0.06),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
            backdropFilter: "blur(18px)",
            minWidth: 520,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: fonts.mono,
              fontSize: 26,
              lineHeight: 1.55,
              color: colors.offWhite,
              letterSpacing: 0.35,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: colors.mint }}>{head}</span>
            {tail}
            <span
              style={{
                display: "inline-block",
                width: 11,
                height: "1.05em",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                background: cursorOn ? colors.mint : "transparent",
                borderRadius: 1,
              }}
            />
          </pre>
        </div>
      </AbsoluteFill>

      {orbits.map((g, i) => {
        const local = Math.max(0, frame - g.delay);
        const appear = springProgress(frame, fps, g.delay, "snap");
        const angle = g.angle + frame * 0.004;
        const baseX = 960 + Math.cos(angle) * g.radius;
        const baseY = 520 + Math.sin(angle) * g.radius * 0.62;
        const outX = (baseX - 960) * (1 + shatter * 1.8) + 960;
        const outY = (baseY - 520) * (1 + shatter * 1.8) + 520 - shatter * 40;
        const gOpacity =
          appear *
          fadeOut *
          interpolate(shatter, [0.55, 1], [1, 0], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: outX,
              top: outY,
              transform: `translate(-50%, -50%) scale(${1 + shatter * 0.4})`,
              fontFamily: fonts.mono,
              fontSize: g.size,
              color: g.mint ? colors.mint : colors.offWhite,
              opacity: gOpacity * 0.9,
              letterSpacing: 1.1,
              filter: `blur(${shatter * 6}px)`,
            }}
          >
            {g.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
