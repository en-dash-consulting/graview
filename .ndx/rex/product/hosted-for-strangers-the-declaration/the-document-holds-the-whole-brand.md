---
id: "569e2a61-35db-44b6-bf64-23bc1b41981b"
type: "capability"
title: "The document holds the whole brand: logo, favicon, typography, shape, accents and a preferred scheme (FR-124)"
slug: "the-document-holds-the-whole-brand"
statement: "A Graview app's document declares its whole brand — logo, favicon, typography, shape, accents and a preferred scheme — which Check validates and both faces draw."
criteria: [{"id":"c1","text":"The document's brand shall accept a logo given as inline SVG or a same-origin path, and a favicon in the same forms."},{"id":"c2","text":"The document's brand shall accept typography with display, body and mono font stacks, naming web fonts only from a small allowlist or as system-serif, system-sans or system-mono."},{"id":"c3","text":"The document's brand shall accept a shape with radius and density, an accents entry giving a hue per kind, and a scheme of light, dark or auto."},{"id":"c4","text":"When a logo is drawn, the faces shall draw it as given and shall not recolour it unless it uses currentColor."},{"id":"c5","text":"If a logo SVG contains a script, an event handler or a load from outside, Check shall refuse it under Cloud's safety rules."},{"id":"c6","text":"Check shall validate the contrast of any brand colour."},{"id":"c7","text":"If a font comes from an origin not on the allowlist, Check shall refuse it."},{"id":"c8","text":"The faces shall draw the wordmark with the logo, headings in the display font and the favicon in the page."},{"id":"c9","text":"When a document declares each brand key, both faces shall draw it in light and in dark."},{"id":"c10","text":"When the logo is an SVG, the faces shall draw it byte for byte."}]
tags:
  - "graview-cloud"
  - "FR-124"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
priority: "critical"
resolution: "Shipped in #133 (0.1.16): the document's brand takes logo, favicon, typography, shape, accents and scheme; graview check refuses a mark that could act or load (brand-mark) and a face off the list (brand-font); AppMark draws the logo and the faces wear the favicon. pnpm verify brand holds it in three engines."
---

DocumentSpec.brand is strict with accent, name, currency and locale; the TypeScript Brand already has logo, typography, shape, accents and schemes, so a declared app always looks like the default.
