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

/** One idea: code becomes constellation. */
export const GlyphsBloom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = beatOpacity(frame, 0, 12, durationInFrames - 28, 26);
  const shatter = springProgress(frame, fps, 70, "settle");
  const glyphFade = interpolate(frame, [85, 140], [1, 0], {
    ...clamp,
    easing: easings.softIn,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <CodeGlyphs fadeOut={glyphFade} shatter={shatter} />
      <BigTitle
        line="Code becomes constellation."
        appearAt={100}
        disappearAt={175}
        size={56}
        voice="literary"
      />
    </AbsoluteFill>
  );
};
