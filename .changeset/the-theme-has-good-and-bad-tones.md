---
"@graview/core": patch
"@graview/primitives": patch
---

The theme has a good tone and a bad tone. `good` and `bad` are tokens in both shipped schemes, written as `--graview-good` and `--graview-bad`, and `TEXT_PAIRS` holds each to 4.5:1 on a panel and on the ground. A badge that says "booked" or "overdue" now wears the theme's own colour and is checked with the rest of the palette. A brand derived from one accent gets both tones from its base (FR-38).

Compatibility: the declaration — breaking for a brand that writes a palette out in full: `ThemeTokens` has two more required tokens, `good` and `bad`. A brand built from `SCHEMES` or `brandFromAccent` has them already. `graview check` measures the four new text pairs, so a palette whose tones cannot be read on its own panel is now an error.
