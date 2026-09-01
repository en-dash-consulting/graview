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
  /**
   * After this local frame, ease slightly lower (no scale change) so the
   * statement can yield vertical space without shrinking text.
   */
  dockAt?: number;
};

/** One decisive statement — big type, mask wipe, fixed size (no shrink). */
export const BigTitle: React.FC<Props> = ({
  line,
  appearAt = 0,
  disappearAt,
  size = 72,
  voice = "display",
  place = "center",
  dockAt,
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, appearAt, disappearAt, 14, 16);
  const wipe = maskWipe(frame, appearAt, 16);
  const blur = blurIn(frame, appearAt, 16, 10);
  const yEnter = interpolate(frame, [appearAt, appearAt + 18], [18, 0], {
    ...clamp,
    easing: easings.softOut,
  });

  const dock =
    dockAt === undefined
      ? 0
      : interpolate(frame, [dockAt, dockAt + 22], [0, 1], {
          ...clamp,
          easing: easings.softOut,
        });

  // Dock by translate only — never change type size (readability).
  const yDock = dock * (place === "lower" ? 18 : 120);
  const padBottom =
    place === "lower"
      ? interpolate(dock, [0, 1], [140, 96])
      : interpolate(dock, [0, 1], [0, 96]);

  return (
    <AbsoluteFill
      style={{
        justifyContent:
          place === "center" && dock < 0.5 ? "center" : "flex-end",
        alignItems: "center",
        paddingBottom: padBottom,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          textAlign: "center",
          transform: `translateY(${yEnter + yDock}px)`,
          filter: `blur(${blur}px)`,
          overflow: "hidden",
          clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
          transformOrigin: "50% 100%",
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
