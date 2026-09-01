import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { BigTitle } from "../components/BigTitle";
import { SurveyInsert } from "../components/SurveyInsert";
import { clamp, easings, fadeIn, fadeOut, springProgress, stagger } from "../motion";
import { beats, colors, fonts } from "../theme";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Coverage you can see — agents you can undo.
 * Beat arc (~10s): empty meaning → agent write → selective undo → UI proof.
 */
export const CoverageAgents: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = beats.coverage.duration;
  const opacity = beatOpacity(frame, 0, 16, dur - 28, 26);
  const cols = 12;
  const rows = 6;

  // Target cell the agent writes into, then undoes
  const targetCol = 7;
  const targetRow = 2;
  const targetIdx = targetRow * cols + targetCol;

  const cells = useMemo(() => {
    const rand = mulberry32(99);
    return Array.from({ length: cols * rows }, (_, i) => ({
      filled: rand() > 0.55,
      phase: rand() * Math.PI * 2,
      hurt: rand() > 0.72,
      i,
      col: i % cols,
      row: Math.floor(i / cols),
    }));
  }, []);

  const lattice = springProgress(frame, fps, 2, "enter");

  // Timeline inside beat (local frames)
  const writeStart = 55;
  const writeDone = 95;
  const undoStart = 195;
  const undoDone = 235;

  const writeT = interpolate(frame, [writeStart, writeDone], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const undoT = interpolate(frame, [undoStart, undoDone], [0, 1], {
    ...clamp,
    easing: easings.wipe,
  });
  const targetFilled = writeT > 0.55 && undoT < 0.55;
  const targetWriting = writeT > 0.15 && writeT < 0.9;
  const targetUndoing = undoT > 0.05 && undoT < 0.95;

  const cursorT = interpolate(frame, [40, writeDone], [0, 1], {
    ...clamp,
    easing: easings.cinematic,
  });
  const cursorGone = interpolate(frame, [undoDone + 4, undoDone + 22], [1, 0], clamp);
  const cellSize = 76;
  const gap = 8;
  const gridW = cols * cellSize + (cols - 1) * gap;
  const gridH = rows * cellSize + (rows - 1) * gap;
  const targetX = targetCol * (cellSize + gap) + cellSize / 2 - gridW / 2;
  const targetY = targetRow * (cellSize + gap) + cellSize / 2 - gridH / 2;
  const cursorX = interpolate(cursorT, [0, 1], [-220, targetX], clamp);
  const cursorY = interpolate(cursorT, [0, 1], [140, targetY], clamp);

  const legendIn = fadeIn(frame, 18, 14);
  const legendOut = fadeOut(frame, 130, 16);
  const legendOp = legendIn * legendOut;

  const undoBadge = fadeIn(frame, undoStart - 8, 10) * fadeOut(frame, undoDone + 10, 14);
  const agentBadge = fadeIn(frame, 38, 12) * fadeOut(frame, undoStart - 6, 12);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gap,
            padding: 22,
            borderRadius: 20,
            background: "rgba(8,16,34,0.72)",
            border: "1px solid rgba(0,229,185,0.28)",
            boxShadow:
              "0 40px 100px rgba(0,0,0,0.5), 0 0 40px rgba(0,229,185,0.06)",
            backdropFilter: "blur(14px)",
            opacity: lattice,
            transform: `scale(${0.94 + lattice * 0.06}) perspective(1400px) rotateX(3deg)`,
          }}
        >
          {cells.map((c) => {
            const isTarget = c.i === targetIdx;
            const cellIn = springProgress(
              frame,
              fps,
              4 + stagger(c.i % 6, 1, 0),
              "snap",
            );
            const pulse =
              0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * 0.14 + c.phase));

            let filled = c.filled;
            if (isTarget) filled = targetFilled;

            const empty = !filled;
            const writingFlash = isTarget && targetWriting;
            const undoingFlash = isTarget && targetUndoing;

            const border = empty
              ? c.hurt || undoingFlash
                ? `rgba(255,92,122,${0.4 + pulse * 0.5})`
                : writingFlash
                  ? `rgba(0,229,185,${0.55 + pulse * 0.4})`
                  : `rgba(0,229,185,${0.35 + pulse * 0.5})`
              : "rgba(122,139,176,0.22)";

            return (
              <div
                key={c.i}
                style={{
                  borderRadius: 10,
                  border: `1.5px solid ${border}`,
                  background: filled
                    ? isTarget
                      ? `rgba(0,229,185,${0.18 + writeT * 0.12})`
                      : "rgba(0,23,105,0.9)"
                    : c.hurt || undoingFlash
                      ? `rgba(255,92,122,${0.08 + pulse * 0.12})`
                      : `rgba(0,229,185,${0.05 + pulse * 0.1})`,
                  boxShadow: empty
                    ? `0 0 ${12 * pulse}px ${
                        c.hurt || undoingFlash
                          ? "rgba(255,92,122,0.35)"
                          : "rgba(0,229,185,0.3)"
                      }`
                    : isTarget
                      ? "0 0 18px rgba(0,229,185,0.45)"
                      : undefined,
                  opacity: 0.4 + cellIn * 0.6,
                  transform: `scale(${
                    0.88 +
                    cellIn * 0.12 +
                    (writingFlash ? 0.06 : 0) +
                    (undoingFlash ? -0.04 : 0)
                  })`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {empty && !isTarget ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      letterSpacing: 0.5,
                      color: c.hurt
                        ? "rgba(255,92,122,0.55)"
                        : "rgba(0,229,185,0.45)",
                      opacity: legendOp * 0.85 + 0.15,
                    }}
                  >
                    ·
                  </div>
                ) : null}

                {isTarget && filled ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 10,
                      borderRadius: 8,
                      background: colors.mint,
                      boxShadow: "0 0 16px rgba(0,229,185,0.55)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.navy,
                      opacity: interpolate(writeT, [0.55, 0.85], [0, 1], clamp),
                    }}
                  >
                    OK
                  </div>
                ) : null}

                {isTarget && undoingFlash ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 8,
                      right: 8,
                      top: "50%",
                      height: 2,
                      background: colors.danger,
                      boxShadow: "0 0 10px rgba(255,92,122,0.7)",
                      transform: `scaleX(${undoT})`,
                      transformOrigin: "left center",
                    }}
                  />
                ) : null}
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 22,
              height: 22,
              marginLeft: -11,
              marginTop: -11,
              borderRadius: 6,
              background: colors.mint,
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow:
                "0 0 20px rgba(0,229,185,0.7), 0 8px 24px rgba(0,0,0,0.45)",
              transform: `translate(${cursorX}px, ${cursorY}px) scale(${
                0.85 + cursorT * 0.2
              })`,
              opacity: cursorT * cursorGone * (targetUndoing ? 0.35 : 1),
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 64,
            opacity: legendOp,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(8,16,34,0.78)",
            border: "1px solid rgba(0,229,185,0.35)",
            backdropFilter: "blur(12px)",
            maxWidth: 340,
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
            coverage lattice
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: fonts.sans,
              fontSize: 16,
              fontWeight: 500,
              color: colors.offWhite,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: "1.5px solid rgba(0,229,185,0.7)",
                background: "rgba(0,229,185,0.08)",
                boxShadow: "0 0 8px rgba(0,229,185,0.35)",
              }}
            />
            Empty cell = never written
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 64,
            left: 64,
            opacity: agentBadge,
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(0,229,185,0.14)",
            border: "1px solid rgba(0,229,185,0.55)",
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: 2,
            color: colors.offWhite,
            textTransform: "uppercase",
          }}
        >
          agent · write
        </div>
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 64,
            opacity: undoBadge,
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(255,92,122,0.15)",
            border: "1px solid rgba(255,92,122,0.55)",
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
        line="Empty cells were never written."
        appearAt={22}
        disappearAt={115}
        size={44}
        voice="literary"
        place="lower"
      />
      <BigTitle
        line="Watch the agent. Take it back."
        appearAt={125}
        disappearAt={dur - 36}
        size={50}
        voice="display"
        place="lower"
        dockAt={210}
      />

      <SurveyInsert
        src="survey/the household example-activity-dark.png"
        label="activity"
        appearAt={70}
        disappearAt={185}
        corner="tr"
        width={620}
        tilt={-9}
        tiltX={5}
        parallax={14}
        depth={0.45}
      />
      <SurveyInsert
        src="survey/proposal-graview-dark.png"
        label="domain proof"
        appearAt={175}
        disappearAt={dur - 24}
        corner="br"
        width={580}
        tilt={8}
        tiltX={-4}
        parallax={10}
        depth={0.4}
      />
    </AbsoluteFill>
  );
};
