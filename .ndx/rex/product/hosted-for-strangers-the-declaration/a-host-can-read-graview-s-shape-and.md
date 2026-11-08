---
id: "a9b0da12-9358-474d-9d41-f178cc1942c7"
type: "capability"
title: "A host can read Graview's shape and type: SHAPE, TYPOGRAPHY and isoShade(scheme) from core (FR-73)"
slug: "a-host-can-read-graview-s-shape-and"
statement: "A host can read Graview's shape, type and isometric block shading from @graview/core, the same values the theme CSS is built from."
criteria: [{"id":"c1","text":"@graview/core shall export SHAPE, TYPOGRAPHY and isoShade(scheme) beside LIGHT, DARK and hueFor."},{"id":"c2","text":"themeCss shall read SHAPE, TYPOGRAPHY and isoShade from @graview/core rather than its own numbers."},{"id":"c3","text":"Cloud's workers/cloud/src/look.ts shall import SHAPE, TYPOGRAPHY and isoShade from @graview/core rather than mirroring them, with no drift lint (lint/look.test.ts) needed."}]
tags:
  - "graview-cloud"
  - "FR-73"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
priority: "medium"
---

Radius, density, the font stacks and the iso block shading exist only inside @graview/primitives' themeCss, so Cloud mirrors them and lints for drift.
