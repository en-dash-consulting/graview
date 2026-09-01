import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { BigTitle } from "../components/BigTitle";
import { SurveyInsert } from "../components/SurveyInsert";
import { fadeIn, springProgress, stagger } from "../motion";
import { colors, fonts } from "../theme";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One idea: coverage you can see — agents you can undo. */
export const CoverageAgents: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 16, durationInFrames - 32, 30);
  const cols = 12;
  const rows = 6;
  const cells = useMemo(() => {
    const rand = mulberry32(99);
    return Array.from({ length: cols * rows }, (_, i) => ({
      filled: rand() > 0.55,
      phase: rand() * Math.PI * 2,
      agent: rand() > 0.88,
      hurt: rand() > 0.7,
      i,
    }));
  }, []);
  const lattice = springProgress(frame, fps, 2, "enter");
  const ribbon = fadeIn(frame, 40, 14);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 72px)`,
            gridTemplateRows: `repeat(${rows}, 72px)`,
            gap: 8,
            padding: 20,
            borderRadius: 20,
            background: "rgba(8,16,34,0.7)",
            border: "1px solid rgba(0,229,185,0.25)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 40px rgba(0,229,185,0.06)",
            backdropFilter: "blur(14px)",
            opacity: lattice,
            transform: `scale(${0.94 + lattice * 0.06}) perspective(1400px) rotateX(3deg)`,
          }}
        >
          {cells.map((c) => {
            const cellIn = springProgress(frame, fps, 4 + stagger(c.i % 6, 1, 0), "snap");
            const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * 0.14 + c.phase));
            const empty = !c.filled;
            const border = empty
              ? c.hurt
                ? `rgba(255,92,122,${0.4 + pulse * 0.5})`
                : `rgba(0,229,185,${0.35 + pulse * 0.5})`
              : "rgba(122,139,176,0.2)";
            return (
              <div
                key={c.i}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: c.filled
                    ? "rgba(0,23,105,0.9)"
                    : c.hurt
                      ? `rgba(255,92,122,${0.08 + pulse * 0.12})`
                      : `rgba(0,229,185,${0.05 + pulse * 0.1})`,
                  boxShadow: empty
                    ? `0 0 ${12 * pulse}px ${c.hurt ? "rgba(255,92,122,0.35)" : "rgba(0,229,185,0.3)"}`
                    : undefined,
                  opacity: 0.4 + cellIn * 0.6,
                  transform: `scale(${0.88 + cellIn * 0.12})`,
                  position: "relative",
                }}
              >
                {c.agent ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 18,
                      borderRadius: 8,
                      background: colors.mint,
                      boxShadow: "0 0 16px rgba(0,229,185,0.55)",
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            top: 64,
            left: 64,
            opacity: ribbon,
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(255,92,122,0.15)",
            border: "1px solid rgba(255,92,122,0.5)",
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: 2,
            color: colors.offWhite,
            textTransform: "uppercase",
          }}
        >
          agent · undo
        </div>
      </AbsoluteFill>

      <BigTitle
        line="Watch the agent. Take it back."
        appearAt={90}
        disappearAt={220}
        size={52}
        voice="display"
        place="lower"
      />

      <SurveyInsert
        src="survey/the household example-activity-dark.png"
        appearAt={50}
        disappearAt={180}
        corner="tr"
        width={420}
        tilt={-8}
        tiltX={5}
        parallax={12}
        depth={0.35}
      />
    </AbsoluteFill>
  );
};
