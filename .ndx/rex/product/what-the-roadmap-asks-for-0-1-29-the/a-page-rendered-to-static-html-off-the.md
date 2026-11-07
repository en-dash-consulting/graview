---
id: "35f35362-578d-4d43-a83c-ae1fb3bd38f6"
type: "capability"
title: "A page rendered to static HTML off the browser (FR-174)"
slug: "a-page-rendered-to-static-html-off-the"
statement: "@graview/pages renders a place of an app to self-contained static HTML, CSS and a title in Node without a DOM, so a fixed link can be re-rendered when the app changes."
criteria: [{"id":"c1","text":"When renderPlace is called from the @graview/pages/static entry with a store, a declaration, a place, a viewer and a look, it shall return { html, css, title } and run in Node with no DOM."},{"id":"c2","text":"renderPlace shall render a list, a record, a place and the home page as self-contained static HTML in the app's look, with no scripts."},{"id":"c3","text":"renderPlace shall render each page under the sight of the viewer it is given."},{"id":"c4","text":"When a rendered page is printed, it shall break the page between sections."},{"id":"c5","text":"renderPlace shall show the describe line and the card as the page shows them."}]
tags:
  - "roadmap"
  - "f-pages-static-render"
  - "FR-174"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Shipped renderPlace(store, declaration, place, { viewer, look, today, base }) => { html, css, title, found } on the new @graview/pages/static entry: describePlace's answer written as one self-contained, script-free, printable document in the app's look under the viewer's sight, with no React, proven to render in a bare context with no DOM; capabilities().shipped gains FR-174."
---

@graview/pages exports React components and a browser router; nothing renders a place to a string. Cloud wants a fixed link (a schedule as a PDF, a roster) re-rendered when the app changes, in a Worker without a DOM. Roadmap f-pages-static-render; unblocks f-live-documents and f-scheduled-sends.
