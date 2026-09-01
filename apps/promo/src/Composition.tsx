import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { sampleCamera } from "./camera";
import { BrandPresence } from "./components/BrandPresence";
import { CameraRig } from "./components/CameraRig";
import { Constellation } from "./components/Constellation";
import { Field } from "./components/Field";
import { LightCharacter } from "./components/LightCharacter";
import { BrandMorph } from "./scenes/BrandMorph";
import { CityAltitude } from "./scenes/CityAltitude";
import { CoverageAgents } from "./scenes/CoverageAgents";
import { GlyphsBloom } from "./scenes/GlyphsBloom";
import { GraphInterface } from "./scenes/GraphInterface";
import { OpenBrand } from "./scenes/OpenBrand";
import { OutroBumper } from "./scenes/OutroBumper";
import { SettleLockup } from "./scenes/SettleLockup";
import { clamp } from "./motion";
import {
  beats,
  colors,
  DIP_WHITE_FRAMES,
  OUTRO_FRAMES,
  STORY_FRAMES,
} from "./theme";

/**
 * Graview intro + En Dash outro bumper.
 *
 * Body: continuous camera spine in one dark field (no TransitionSeries).
 * Stitch: field brightens, then dip-to-white over last DIP_WHITE_FRAMES.
 * Outro: OffthreadVideo of endash-outro.mp4 (white field) — white → white.
 */
export const GraviewIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const inStory = frame < STORY_FRAMES;
  const cam = sampleCamera(frame);
  const c = cam.constellation;

  const dipStart = STORY_FRAMES - DIP_WHITE_FRAMES;
  // Lift field toward white *before* the pure white overlay so we never
  // crush into a black void then flash white.
  const liftStart = dipStart - 42;
  const fieldLift = inStory
    ? interpolate(frame, [liftStart, dipStart], [0, 0.55], clamp)
    : 0;
  const whiteDip = inStory
    ? interpolate(frame, [dipStart, STORY_FRAMES - 1], [0, 1], clamp)
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.field }}>
      {inStory ? (
        <Field bloom={cam.bloom}>
          <CameraRig camera={cam}>
            <Constellation
              bloom={c.bloom}
              pulse={c.pulse}
              drift={c.drift}
              settle={c.settle}
              edgeProgress={c.edgeProgress}
              count={34}
              seed={42}
              focus={cam.focus}
              dof
            />

            <Sequence
              from={beats.open.from}
              durationInFrames={beats.open.duration}
              name="0 Open En Dash"
              layout="none"
            >
              <OpenBrand />
            </Sequence>

            <Sequence
              from={beats.glyphs.from}
              durationInFrames={beats.glyphs.duration}
              name="1 Glyphs bloom"
              layout="none"
            >
              <GlyphsBloom />
            </Sequence>

            <Sequence
              from={beats.graph.from}
              durationInFrames={beats.graph.duration}
              name="2 Graph interface"
              layout="none"
            >
              <GraphInterface />
            </Sequence>

            <Sequence
              from={beats.city.from}
              durationInFrames={beats.city.duration}
              name="3 City altitude"
              layout="none"
            >
              <CityAltitude />
            </Sequence>

            <Sequence
              from={beats.coverage.from}
              durationInFrames={beats.coverage.duration}
              name="4 Coverage agents"
              layout="none"
            >
              <CoverageAgents />
            </Sequence>

            <Sequence
              from={beats.brand.from}
              durationInFrames={beats.brand.duration}
              name="5 Brand morph"
              layout="none"
            >
              <BrandMorph />
            </Sequence>

            <Sequence
              from={beats.settle.from}
              durationInFrames={beats.settle.duration}
              name="6 Settle lockup"
              layout="none"
            >
              <SettleLockup />
            </Sequence>
          </CameraRig>

          <LightCharacter />
          <BrandPresence hideFrom={beats.brand.from} />
        </Field>
      ) : null}

      {/* Soft off-white lift — raises field brightness into the dip */}
      {inStory && fieldLift > 0.01 ? (
        <AbsoluteFill
          style={{
            backgroundColor: colors.white,
            opacity: fieldLift * 0.35,
          }}
        />
      ) : null}

      {/* Dip-to-white — intentional break into bumper aesthetic */}
      {inStory && whiteDip > 0.01 ? (
        <AbsoluteFill
          style={{
            backgroundColor: colors.white,
            opacity: whiteDip,
          }}
        />
      ) : null}

      <Sequence
        from={STORY_FRAMES}
        durationInFrames={OUTRO_FRAMES}
        name="7 En Dash outro"
      >
        <OutroBumper />
      </Sequence>
    </AbsoluteFill>
  );
};
