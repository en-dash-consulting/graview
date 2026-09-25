import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { colors, feedBeats } from "./feedTheme";
import { Cta } from "./feed/Cta";
import { Lockup } from "./feed/Lockup";
import { MagicHook } from "./feed/MagicHook";
import { StoryMontage } from "./feed/StoryMontage";
import { TaglinePayoff } from "./feed/TaglinePayoff";

/**
 * GraviewFeed — square 1:1 mute-first social promo (~15s / 450f @ 30fps).
 * Kinetic product story: magic → tagline → montage → lock → CTA.
 * Landscape GraviewIntro stays untouched.
 */
export const GraviewFeed: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.field }}>
      <Sequence
        from={feedBeats.magic.from}
        durationInFrames={feedBeats.magic.duration}
        name="0 Magic hook"
      >
        <MagicHook />
      </Sequence>

      <Sequence
        from={feedBeats.tagline.from}
        durationInFrames={feedBeats.tagline.duration}
        name="1 Tagline payoff"
      >
        <TaglinePayoff />
      </Sequence>

      <Sequence
        from={feedBeats.montage.from}
        durationInFrames={feedBeats.montage.duration}
        name="2 Story montage"
      >
        <StoryMontage />
      </Sequence>

      <Sequence
        from={feedBeats.lockup.from}
        durationInFrames={feedBeats.lockup.duration}
        name="3 Identity lock"
      >
        <Lockup />
      </Sequence>

      <Sequence
        from={feedBeats.cta.from}
        durationInFrames={feedBeats.cta.duration}
        name="4 CTA"
      >
        <Cta />
      </Sequence>
    </AbsoluteFill>
  );
};
