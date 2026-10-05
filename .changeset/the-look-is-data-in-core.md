---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A host can read Graview's shape, type and block lighting from `@graview/core`, beside `LIGHT`, `DARK` and `hueFor` (FR-73). The radius, the density, the font stacks and the way a block's three faces are lit lived only as numbers inside `themeCss`. So Graview Cloud, which dresses its signed-in pages as a Graview app and does not depend on the UI package, copied them and linted the copy. They are now plain frozen data in core: `SHAPE` (a radius of 12, a density of 1, and the pixels of padding and gap that density 1 means), `TYPOGRAPHY` (the body and mono stacks) and `isoShade(scheme)`, the roof, the two walls and the plot under them as saturation and lightness with no hue, plus the roof's lit edge. `shapeOf(brand)` and `typographyOf(brand)` resolve a brand against them: a brand's `shape.radius` and `shape.density` win where it declared them, and a display face falls back to the body face. The lighting is not a brand's to set. A brand composes with it through `accents`, because the hue of every face is the kind's, `hueFor(kind, brand.accents)`. `themeCss` now reads all of these instead of its own numbers, so there is one source. Its output is byte-identical to before for the framework's brand, a bare brand, an accent-derived brand and a square, tight brand set in Inter, in both schemes, scoped and not. `GRAVIEW_BRAND.typography` is `TYPOGRAPHY`'s two stacks.

A core test holds the values, holds that they are frozen and survive JSON, and holds how a brand's radius, density and faces resolve. A primitives test holds that `themeCss` emits exactly `shapeOf`, `typographyOf` and `isoShade` for three brands in both schemes. The graview-brand skill says where the defaults live, and that a page dressed to match reads them rather than copying numbers. `capabilities().shipped` names FR-73.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-73`. `themeCss` output is unchanged. Ops, stored formats, the declaration, check codes and tool schemas are unchanged.
