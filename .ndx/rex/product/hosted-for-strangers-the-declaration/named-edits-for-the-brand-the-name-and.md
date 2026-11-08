---
id: "e85b0ac4-3c49-49f1-a311-5c49e815e467"
type: "capability"
title: "Named edits for the brand, the name and the subtitle (FR-125)"
slug: "named-edits-for-the-brand-the-name-and"
statement: "A Graview app's name, subtitle and logo are changed through named edits that preview, apply and roll back, and the description is drawn as the subtitle under the name on both faces."
criteria: [{"id":"c1","text":"The set-brand edit shall accept every FR-124 key, clearing a key when its value is null."},{"id":"c2","text":"The set-name edit shall take a name and change the app's name, and the set-description edit shall take a description and change the app's description."},{"id":"c3","text":"When a name, description or logo edit is previewed, the diff shall say it in a sentence such as 'The app is now called…' or 'The logo changes'."},{"id":"c4","text":"The app shall draw its description as its subtitle under its name on both faces."},{"id":"c5","text":"The set-brand, set-name and set-description edits shall each preview, apply and roll back through editDocument."},{"id":"c6","text":"When describePlace(\"home\") is called, it shall report the app's name, its subtitle and its logo, with the logo's alt text when the logo is present."}]
tags:
  - "graview-cloud"
  - "FR-125"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
priority: "critical"
resolution: "Shipped in #133 (0.1.16): set-brand takes every brand key and null clears one; set-name and set-description are edits of their own; diffDocuments says each in words. Since #137 the description is the name's hover in the bar and the line on the routed face's home."
---

The name changes only through a raw JSON Patch on /name; nothing says whether description is drawn.
