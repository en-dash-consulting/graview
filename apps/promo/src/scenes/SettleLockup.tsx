import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { fadeIn, springProgress } from "../motion";
import { beats, colors, fonts, tagline } from "../theme";

/** Lockup hold — then composition dips to white into En Dash outro. */
export const SettleLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Soft out into the composition white dip (last ~DIP_WHITE frames)
  const opacity = beatOpacity(frame, 0, 12, beats.settle.duration - 28, 22);
  const lock = springProgress(frame, fps, 16, "settle");
  const tag = fadeIn(frame, 55, 18);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: lock,
          transform: `translateY(${(1 - lock) * 12}px) scale(${0.95 + lock * 0.05})`,
        }}
      >
        <Img
          src={staticFile("endash-mark.svg")}
          style={{
            width: 88,
            height: 88,
            marginBottom: 26,
            filter: "drop-shadow(0 16px 40px rgba(0,229,185,0.28))",
          }}
        />
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: 14,
            color: colors.white,
            textShadow: "0 12px 48px rgba(0,0,0,0.45)",
          }}
        >
          GRAVIEW
        </div>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: fonts.display,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 2.5,
            color: colors.mint,
          }}
        >
          <span>En Dash</span>
          <span style={{ opacity: 0.4, color: colors.offWhite }}>·</span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 16,
              letterSpacing: 1.2,
              color: colors.muted,
            }}
          >
            @graview/*
          </span>
        </div>
        <div
          style={{
            marginTop: 36,
            maxWidth: 780,
            textAlign: "center",
            fontFamily: fonts.literary,
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: 24,
            color: colors.offWhite,
            opacity: tag,
            textShadow: "0 8px 36px rgba(0,0,0,0.5)",
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
