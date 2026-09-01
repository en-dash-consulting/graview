import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatOpacity } from "../camera";
import { BigTitle } from "../components/BigTitle";
import { CodeGlyphs } from "../components/CodeGlyphs";
import { clamp, easings, springProgress } from "../motion";
import { beats } from "../theme";

/** One idea: declare the domain (defineNode) → the application follows. */
export const GlyphsBloom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 16, beats.glyphs.duration - 36, 34);
  const shatter = springProgress(frame, fps, 70, "settle");
  const glyphFade = interpolate(frame, [85, 140], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <CodeGlyphs fadeOut={glyphFade} shatter={shatter} />
      <BigTitle
        line="Declare entities. Get the app."
        appearAt={95}
        disappearAt={170}
        size={52}
        voice="display"
      />
    </AbsoluteFill>
  );
};
