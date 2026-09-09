---
id: "f59ea8e1-68bf-4320-b226-96db703ab81b"
level: "feature"
title: "Live, embeddable chapters: mount a Graview app into any element, with a face toggle"
status: "pending"
priority: "high"
acceptanceCriteria: []
description: "The marketing page teaches from twelve photographed chapters of the garden. Photographs are honest but dead: a reader cannot rise to the Graview, descend into a plot, or open the routed face. Each chapter should be a LIVE Graview view inside docs/site/index.html, toggleable between three faces — the scene (focus), the Graview (altitude) and the Pages face (the routed traditional web view at phone width). The page is also published as a Claude artifact whose CSP allows only inlined scripts (no external fetch, no cross-origin iframes), so the embed must be a self-contained bundle. That forces the framework to grow what it lacks for easy embedding: a public mount API — mount(el, { app, seed, face, stop, principal, brand, lenses, pages }) — that works without the Shell, a scene that fits a small container rather than the viewport, theme tokens scoped to the element rather than the document, fonts that do not depend on the host page, and an in-memory adapter by default. The same embed is what docs, graview-cloud previews and third-party pages would use. The progression harness keeps photographing chapters for CI and the record; the page uses the live embeds; the site-artifact build inlines the bundle."
lastModified: "2026-09-09T19:44:38.952Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [An embed API: mount(el, …) renders a declared app into any element, without the Shell](./an-embed-api-mount-el-renders-a.md) | pending |
| [The live page still holds: site harness at every width, artifact under 16MB, no console errors per embed](./the-live-page-still-holds-site-harness.md) | pending |
| [The page's chapters are live: one embed per chapter, a three-face toggle, the same seed the photograph used](./the-page-s-chapters-are-live-one-embed.md) | pending |
