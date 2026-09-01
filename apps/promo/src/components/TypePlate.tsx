import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { blurIn, clamp, easings, fadeWindow, maskWipe } from "../motion";
import { colors, fonts } from "../theme";

type Props = {
  line: string;
  sub?: string;
  appearAt?: number;
  disappearAt?: number;
  align?: "center" | "bottom" | "lower-third";
  /** literary | display | mono */
  voice?: "literary" | "display" | "mono";
  size?: number;
};

/**
 * Premium on-screen copy — decisive mask wipe + blur-settle.
 * One line at a time; tight tracking/leading.
 */
export const TypePlate: React.FC<Props> = ({
  line,
  sub,
  appearAt = 0,
  disappearAt,
  align = "lower-third",
  voice = "literary",
  size,
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, appearAt, disappearAt, 14, 12);
  const y = interpolate(frame, [appearAt, appearAt + 16], [10, 0], {
    ...clamp,
    easing: easings.softOut,
  });
  const blur = blurIn(frame, appearAt, 16, 7);
  const wipe = maskWipe(frame, appearAt, 15);

  const fontFamily =
    voice === "literary"
      ? fonts.literary
      : voice === "mono"
        ? fonts.mono
        : fonts.display;

  const fontSize =
    size ?? (voice === "literary" ? 32 : voice === "mono" ? 20 : 38);
  const fontWeight = voice === "display" ? 600 : voice === "mono" ? 500 : 300;
  const letterSpacing =
    voice === "literary" ? 0.2 : voice === "display" ? 0.5 : 1.4;
  const lineHeight = voice === "literary" ? 1.28 : 1.2;

  const justify =
    align === "center"
      ? "center"
      : align === "bottom" || align === "lower-third"
        ? "flex-end"
        : "center";

  return (
    <AbsoluteFill
      style={{
        justifyContent: justify,
        alignItems: "center",
        paddingBottom: align === "center" ? 0 : 80,
        opacity,
        transform: `translateY(${y}px)`,
        filter: `blur(${blur}px)`,
        pointerEvents: "none",
      }}
    >
      <div style={{ maxWidth: 1000, textAlign: "center" }}>
        <div
          style={{
            overflow: "hidden",
            clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
          }}
        >
          <div
            style={{
              color: colors.offWhite,
              fontFamily,
              fontSize,
              fontWeight,
              letterSpacing,
              lineHeight,
              fontStyle: voice === "literary" ? "italic" : "normal",
              textShadow: "0 10px 44px rgba(0,0,0,0.6)",
            }}
          >
            {line}
          </div>
        </div>
        {sub ? (
          <div
            style={{
              marginTop: 14,
              color: colors.mint,
              fontFamily: fonts.mono,
              fontSize: 14,
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 500,
              opacity: interpolate(frame, [appearAt + 10, appearAt + 22], [0, 1], clamp),
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
