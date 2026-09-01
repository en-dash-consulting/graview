import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { blurIn, clamp, easings, fadeWindow, maskWipe } from "../motion";
import { colors, fonts } from "../theme";

type Props = {
  line: string;
  appearAt?: number;
  disappearAt?: number;
  size?: number;
  voice?: "display" | "literary";
  /** Vertical bias: center | lower */
  place?: "center" | "lower";
};

/** One decisive statement — big type, mask wipe, no chrome. */
export const BigTitle: React.FC<Props> = ({
  line,
  appearAt = 0,
  disappearAt,
  size = 72,
  voice = "display",
  place = "center",
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, appearAt, disappearAt, 14, 16);
  const wipe = maskWipe(frame, appearAt, 16);
  const blur = blurIn(frame, appearAt, 16, 10);
  const y = interpolate(frame, [appearAt, appearAt + 18], [18, 0], {
    ...clamp,
    easing: easings.softOut,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: place === "center" ? "center" : "flex-end",
        alignItems: "center",
        paddingBottom: place === "lower" ? 140 : 0,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          textAlign: "center",
          transform: `translateY(${y}px)`,
          filter: `blur(${blur}px)`,
          overflow: "hidden",
          clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
        }}
      >
        <div
          style={{
            fontFamily: voice === "literary" ? fonts.literary : fonts.display,
            fontStyle: voice === "literary" ? "italic" : "normal",
            fontWeight: voice === "literary" ? 300 : 700,
            fontSize: size,
            letterSpacing: voice === "literary" ? 0.2 : 0.5,
            lineHeight: 1.12,
            color: colors.white,
            textShadow: "0 16px 60px rgba(0,0,0,0.55)",
          }}
        >
          {line}
        </div>
      </div>
    </AbsoluteFill>
  );
};
