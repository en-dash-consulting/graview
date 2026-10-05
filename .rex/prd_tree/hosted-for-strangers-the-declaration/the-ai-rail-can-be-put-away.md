---
id: "de75d28d-c5cd-4c33-b3e7-d9a9fbca0fe4"
level: "feature"
title: "The AI rail can be put away: collapse to a tab, overlay when narrow, and a host's starting state (FR-78)"
status: "completed"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-78"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
acceptanceCriteria:
  - "The strip has a control that collapses the companion to a slim tab and opens it again; the state is remembered per reader"
  - "Below a width it overlays the scene instead of taking a column"
  - "mount(…, { companion: \"open\" | \"collapsed\" | \"hidden\" }) sets the start"
  - "With it collapsed, the scene and its controls use the whole width"
description: "The companion takes a fixed column on every wide screen whether or not the person is talking to it, and squeezes the scene on a narrow window."
lastModified: "2026-10-05T04:56:18.000Z"
---
