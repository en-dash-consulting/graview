---
id: "3e4ba671-70ea-408d-a542-0fe6e3f5e31b"
type: "capability"
title: "Embed holds inside a chat's widget: no storage assumed, its own height reported, the host's scheme taken"
slug: "embed-holds-inside-a-chat-s-widget-no"
statement: "Embed mounts a Graview app inside a chat widget's sandboxed iframe, where it reports its own height and works without storage."
criteria: [{"id":"c1","text":"When localStorage throws in a sandboxed iframe, mount shall still render the app."},{"id":"c2","text":"When the embedded content's height changes, the embed shall report each change as it happens."},{"id":"c3","text":"When a pages-face widget is shown at 360 px width, the embed shall pass axe in both the light and dark schemes."}]
tags:
  - "graview-cloud"
  - "FR-13"
source: "Graview Cloud FR-13, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: mount(element, {...}) renders a scene, Graview or pages face into an element with an in-memory or passed store. MISSING: the MCP Apps iframe a ChatGPT or Claude widget runs in may refuse storage, sizes from the content, and hands a theme over postMessage. POSITION: embed with no localStorage dependency (settings and remembered state injectable), an onIntrinsicHeight callback, scheme/theme from the host context, a remote store, and the scene degrading to the pages face below a width.
