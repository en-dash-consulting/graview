---
id: "aab02be9-0716-498d-8200-210edcd020f0"
type: "capability"
title: "Branding an installation without forking it"
slug: "branding-an-installation-without"
statement: "A product brands an installation by declaring a theme (palette, logo, product name and typography) that the framework validates and applies without touching @graview/primitives."
criteria: [{"id":"c1","text":"When a theme is declared, the framework shall validate and apply it without any change to @graview/primitives."},{"id":"c2","text":"When graview check runs, it shall verify that every token pair that carries text meets WCAG AA."},{"id":"c3","text":"If a token pair that carries text fails WCAG AA, graview check shall name the failing pair."},{"id":"c4","text":"When a brand supplies a single accent colour, the framework shall either derive a coherent pair of light and dark schemes or refuse and say what else is needed."},{"id":"c5","text":"A theme shall declare the logo, the product name and the typography alongside the palette."},{"id":"c6","text":"The framework shall express the existing light and dark schemes as ordinary declared themes, with no special case for the built-ins."}]
priority: "high"
---

The token layer is already there: every primitive reads custom properties and `themeCss(scheme)` emits them, so a brand should be a DECLARED THEME rather than a fork of the primitives.

The part worth getting right is that a custom palette can be wrong in ways nobody notices. Contrast is already verified on every a11y run, so this is a property the framework can CHECK rather than trust — a theme should pass `graview check` the way a schema does, before it ships, not after someone files a bug.

And the two schemes are not inversions of each other: dark loses luminance, light loses contrast and gains haze. A brand handing over one accent colour is not a theme, and the framework should derive what it can and say plainly what it cannot.
