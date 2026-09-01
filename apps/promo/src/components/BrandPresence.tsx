import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { clamp, easings } from "../motion";
import { colors, fonts } from "../theme";

type Props = { hideFrom?: number };

/** Persistent En Dash corner lockup — open through mid-film. */
export const BrandPresence: React.FC<Props> = ({ hideFrom = 1050 }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [12, 40], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const word = interpolate(frame, [32, 55], [0, 1], {
    ...clamp,
    easing: easings.softOut,
  });
  const exit = interpolate(frame, [hideFrom - 18, hideFrom], [1, 0], clamp);
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 48,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity,
          transform: `translateY(${(1 - enter) * 8}px)`,
        }}
      >
        <Img
          src={staticFile("endash-mark.svg")}
          style={{
            width: 40,
            height: 40,
            filter: "drop-shadow(0 8px 20px rgba(0,229,185,0.25))",
          }}
        />
        <div
          style={{
            opacity: word,
            fontFamily: fonts.display,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 2.5,
            color: colors.mint,
          }}
        >
          En Dash
        </div>
      </div>
    </AbsoluteFill>
  );
};
