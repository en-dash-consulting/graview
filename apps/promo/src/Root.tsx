import React from "react";
import { Composition } from "remotion";
import { GraviewIntro } from "./Composition";
import { GraviewFeed } from "./FeedComposition";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";
import {
  FEED_DURATION,
  FEED_FPS,
  FEED_HEIGHT,
  FEED_WIDTH,
} from "./feedTheme";

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
      <Composition
        id="GraviewFeed"
        component={GraviewFeed}
        durationInFrames={FEED_DURATION}
        fps={FEED_FPS}
        width={FEED_WIDTH}
        height={FEED_HEIGHT}
      />
    </>
  );
};
