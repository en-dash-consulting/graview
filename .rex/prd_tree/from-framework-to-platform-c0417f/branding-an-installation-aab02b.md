---
id: "aab02be9-0716-498d-8200-210edcd020f0"
level: "feature"
title: "Branding an installation without forking it"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "A theme is declared, validated and applied without touching @graview/primitives"
  - "graview check verifies every token pair that carries text meets WCAG AA, and names the failing pair"
  - "A brand supplying a single accent gets a coherent pair of schemes, or a clear refusal saying what else is needed"
  - "Logo, product name and typography are declared alongside the palette"
  - "The existing two schemes are expressible as ordinary declared themes — no special case for the built-ins"
description: "The token layer is already there: every primitive reads custom properties and `themeCss(scheme)` emits them, so a brand should be a DECLARED THEME rather than a fork of the primitives.\n\nThe part worth getting right is that a custom palette can be wrong in ways nobody notices. Contrast is already verified on every a11y run, so this is a property the framework can CHECK rather than trust — a theme should pass `graview check` the way a schema does, before it ships, not after someone files a bug.\n\nAnd the two schemes are not inversions of each other: dark loses luminance, light loses contrast and gains haze. A brand handing over one accent colour is not a theme, and the framework should derive what it can and say plainly what it cannot."
---
