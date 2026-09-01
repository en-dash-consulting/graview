---
id: "305f2b21-0dc3-426f-b927-6a139ebb8762"
level: "feature"
title: "Theming and look-and-feel: a declarative customization API a skill can drive"
status: "pending"
priority: "high"
source: "user request 2026-09-01: \"there's still not enough customization look-n-feel type junts across the apps ... configure the views and theming very easily and that should be a clear api so that the skills for this should be able to really beautifully help someone through natural language to make this very specific to their shit\""
acceptanceCriteria:
  - "A ThemeSpec (or extended Brand) declaration covers tokens, per-kind accents, density/radius, and both schemes from one source; theme.ts renders from it"
  - "Per-kind look overrides flow through the view registry, never through CSS reach-ins"
  - "graview check (or promoted verify-brand) validates contrast and completeness of a declared theme"
  - "All example apps restyle via declaration only — zero component edits — and the harness suite stays green"
  - "A styling skill exists that converses in natural language, edits only the declaration, and can show before/after screenshots"
  - "The spec is serialisable JSON-compatible data suitable for per-workspace storage in graview-cloud"
description: "Apps can pass a Brand (name, wordmark, typography, palette) but almost everything else about look and feel is baked into theme.ts and the default views. There is no clear, declarative surface where an app — or a person talking to an assistant — can say \"make it feel like mine\".\n\nTwo deliverables. (1) The API: extend the brand/theme declaration into a full, checkable theme spec — token scales (surface, ink, edge, accent, warn), per-kind accent/iconography, density/radius/elevation choices, light+dark schemes derived from one source, and per-kind view overrides that go through the existing view registry (register over a cell) rather than CSS forking. theme.ts consumes tokens; graview check validates the palette (contrast, completeness — verify-brand.mjs already measures some of this, promote it). Everything declarative and serialisable, because (2) the skill: a Claude/assistant skill that walks someone through styling in natural language (\"warmer, more editorial, our green is #1B4\") and writes the declaration — which only works if the whole look is data with a schema, not scattered constants. The skill should be able to preview via the existing harness screenshot machinery. This is also a graview-cloud prerequisite: hosted workspaces customize without shipping code."
---
