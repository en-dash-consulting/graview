import React from "react";
import { AbsoluteFill } from "remotion";
import type { CameraState } from "../camera";

type Props = {
  camera: CameraState;
  children?: React.ReactNode;
};

/**
 * Persistent camera transform — one voyage through the field.
 * Children live in the same world; beats morph rather than dissolve.
 */
export const CameraRig: React.FC<Props> = ({ camera, children }) => {
  const { x, y, scale, rotate, tiltX, perspective } = camera;

  return (
    <AbsoluteFill
      style={{
        perspective,
        perspectiveOrigin: "50% 45%",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          transform: `
            translate(${x}px, ${y}px)
            scale(${scale})
            rotate(${rotate}deg)
            rotateX(${tiltX}deg)
          `,
          transformOrigin: "50% 48%",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
