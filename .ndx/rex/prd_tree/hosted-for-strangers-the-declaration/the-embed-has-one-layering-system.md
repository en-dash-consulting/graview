---
id: "dcab0d73-d7f8-40f3-b6b4-149fd39f5558"
level: "feature"
title: "The embed has one layering system: popovers in the top layer, persistent surfaces on one ladder (FR-76)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-76"
  - "bug"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
acceptanceCriteria:
  - "Transient surfaces (every popover, menu and tooltip) open in the browser's top layer (the Popover API) or one documented layer above every panel, so nothing in the embed covers them"
  - "Persistent surfaces take named layers from one ladder: scene < overview < rails and floating controls < popovers < dialogs < toasts"
  - "A test opens each popover on each face at 1440x900 and 390x844 and finds elementFromPoint inside it to be the popover"
  - "Cloud's installShellStyles override of [data-testid=\"profile\"] z-index is deleted"
description: "Each surface picks its own inline z-index (profile and problems popovers 20, companion 40, zoom 8, overview 5) in one stacking context, so on a hosted app the profile menu opens under the AI rail and can't be read (found by Nick on staging)."
lastModified: "2026-10-05T04:56:18.000Z"
---
