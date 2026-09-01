import React from "react";
import { Composition } from "remotion";
import { GraviewIntro } from "./Composition";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GraviewIntro"
        component={GraviewIntro}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
