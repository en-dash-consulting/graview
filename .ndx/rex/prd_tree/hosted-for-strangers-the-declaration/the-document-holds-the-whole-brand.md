---
id: "569e2a61-35db-44b6-bf64-23bc1b41981b"
level: "feature"
title: "The document holds the whole brand: logo, favicon, typography, shape, accents and a preferred scheme (FR-124)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-124"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
startedAt: "2026-10-07T19:13:27.000Z"
completedAt: "2026-10-07T19:13:27.000Z"
endedAt: "2026-10-07T19:13:27.000Z"
acceptanceCriteria:
  - "brand gains logo (inline SVG or same-origin path like /graview/assets/<sha>.svg; drawn as given, not recoloured unless currentColor), favicon (same forms), typography { display?, body?, mono? } (font stacks; named web fonts only from a small allowlist, or system-serif/system-sans/system-mono), shape { radius?, density? }, accents (hue per kind), scheme light|dark|auto"
  - "Check validates each: a logo SVG under Cloud's safety rules (no script, handlers or outside loads); contrast for any colour; a font from an origin not on the list refused"
  - "The faces draw them: the wordmark with the logo, headings in display, the favicon in the page; a document with each key draws on both faces, light and dark; an SVG logo draws byte for byte"
description: "DocumentSpec.brand is strict with accent, name, currency and locale; the TypeScript Brand already has logo, typography, shape, accents and schemes, so a declared app always looks like the default."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #133 (0.1.16): the document's brand takes logo, favicon, typography, shape, accents and scheme; graview check refuses a mark that could act or load (brand-mark) and a face off the list (brand-font); AppMark draws the logo and the faces wear the favicon. pnpm verify brand holds it in three engines."
---
