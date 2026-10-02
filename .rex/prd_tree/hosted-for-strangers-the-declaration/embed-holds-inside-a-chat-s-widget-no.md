---
id: "3e4ba671-70ea-408d-a542-0fe6e3f5e31b"
level: "feature"
title: "Embed holds inside a chat's widget: no storage assumed, its own height reported, the host's scheme taken"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-13"
source: "Graview Cloud FR-13, 2026-10-02"
acceptanceCriteria:
  - "mount works in a sandboxed iframe where localStorage throws"
  - "Height changes are reported as they happen"
  - "A pages-face widget at 360 px passes axe in both schemes"
description: "WHAT IS THERE NOW: mount(element, {...}) renders a scene, Graview or pages face into an element with an in-memory or passed store. MISSING: the MCP Apps iframe a ChatGPT or Claude widget runs in may refuse storage, sizes from the content, and hands a theme over postMessage. POSITION: embed with no localStorage dependency (settings and remembered state injectable), an onIntrinsicHeight callback, scheme/theme from the host context, a remote store, and the scene degrading to the pages face below a width."
lastModified: "2026-10-02T20:55:09.326Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
