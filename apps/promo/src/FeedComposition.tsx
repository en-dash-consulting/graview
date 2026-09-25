import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { colors, feedBeats } from "./feedTheme";
import { Cta } from "./feed/Cta";
import { Lockup } from "./feed/Lockup";
import { MagicHook } from "./feed/MagicHook";
import { StepsBeat } from "./feed/StepsBeat";
import { StoryMontage } from "./feed/StoryMontage";
import { TaglinePayoff } from "./feed/TaglinePayoff";

/**
 * GraviewFeed — square 1:1 mute-first social promo (~22s / 660f @ 30fps).
 * Kinetic product story: magic → tagline → steps → montage → lock → CTA.
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
        from={feedBeats.steps.from}
        durationInFrames={feedBeats.steps.duration}
        name="2 Steps"
      >
        <StepsBeat />
      </Sequence>

      <Sequence
        from={feedBeats.montage.from}
        durationInFrames={feedBeats.montage.duration}
        name="3 Story montage"
      >
        <StoryMontage />
      </Sequence>

      <Sequence
        from={feedBeats.lockup.from}
        durationInFrames={feedBeats.lockup.duration}
        name="4 Identity lock"
      >
        <Lockup />
      </Sequence>

      <Sequence
        from={feedBeats.cta.from}
        durationInFrames={feedBeats.cta.duration}
        name="5 CTA"
      >
        <Cta />
      </Sequence>
    </AbsoluteFill>
  );
};
