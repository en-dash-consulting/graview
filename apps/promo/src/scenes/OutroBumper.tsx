import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { colors, OUTRO_PLAYBACK_RATE } from "../theme";

/**
 * Nick’s En Dash outro — white field / navy serif / mark.
 * Preceded by dip-to-white so stitch is white → white (never navy muddy crossfade).
 * playbackRate shortens the 16s source (~10s at 1.6×).
 */
export const OutroBumper: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.white }}>
      <OffthreadVideo
        src={staticFile("endash-outro.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        playbackRate={OUTRO_PLAYBACK_RATE}
        muted
      />
    </AbsoluteFill>
  );
};
