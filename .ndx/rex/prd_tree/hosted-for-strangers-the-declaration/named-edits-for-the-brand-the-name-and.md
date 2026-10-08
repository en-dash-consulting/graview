---
id: "e85b0ac4-3c49-49f1-a311-5c49e815e467"
level: "feature"
title: "Named edits for the brand, the name and the subtitle (FR-125)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-125"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
startedAt: "2026-10-07T19:13:27.000Z"
completedAt: "2026-10-07T19:13:27.000Z"
endedAt: "2026-10-07T19:13:27.000Z"
acceptanceCriteria:
  - "set-brand takes every FR-124 key (null clears one); new set-name { name } and set-description { description }, with diff sentences ('The app is now called…', 'The logo changes')"
  - "The description is drawn as the app's subtitle under its name on both faces"
  - "Each previews, applies and rolls back through editDocument; describePlace(\"home\") reports the name, the subtitle and the logo (present, with its alt text)"
description: "The name changes only through a raw JSON Patch on /name; nothing says whether description is drawn."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #133 (0.1.16): set-brand takes every brand key and null clears one; set-name and set-description are edits of their own; diffDocuments says each in words. Since #137 the description is the name's hover in the bar and the line on the routed face's home."
---
