import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, springProgress } from "../motion";
import { colors, fonts, FEED_SAFE } from "../feedTheme";

/**
 * Hard CTA — navy / mint-accent card.
 * npm create graview@latest · graview.dev
 */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const card = springProgress(frame, fps, 1, "premium");
  const cmd = springProgress(frame, fps, 8, "snap");
  const url = springProgress(frame, fps, 18, "enter");
  const hold = interpolate(frame, [0, 4], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.navy,
        opacity: hold,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: FEED_SAFE.side,
        paddingRight: FEED_SAFE.side,
        paddingTop: FEED_SAFE.top,
        paddingBottom: FEED_SAFE.bottom,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 48%, rgba(0,229,185,0.2) 0%, transparent 52%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          opacity: card,
          transform: `translateY(${(1 - card) * 28}px) scale(${0.94 + card * 0.06})`,
          width: "100%",
          maxWidth: 920,
          backgroundColor: colors.field,
          border: `2px solid rgba(0,229,185,0.45)`,
          borderRadius: 28,
          padding: "56px 48px",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.45), 0 0 48px rgba(0,229,185,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            opacity: cmd,
            width: "100%",
            backgroundColor: colors.fieldElevated,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: 16,
            padding: "26px 24px",
            fontFamily: fonts.mono,
            fontSize: 32,
            fontWeight: 600,
            color: colors.mint,
            textAlign: "center",
            letterSpacing: -0.3,
            boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
          }}
        >
          npm create graview@latest
        </div>

        <div
          style={{
            opacity: url,
            transform: `translateY(${(1 - url) * 10}px)`,
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 42,
            color: colors.offWhite,
            letterSpacing: 1.5,
          }}
        >
          graview.dev
        </div>
      </div>
    </AbsoluteFill>
  );
};
