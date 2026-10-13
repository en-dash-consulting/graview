---
id: "35f35362-578d-4d43-a83c-ae1fb3bd38f6"
level: "feature"
title: "A page rendered to static HTML off the browser (FR-174)"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "f-pages-static-render"
  - "FR-174"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "renderPlace(store, declaration, place, { viewer, look }) => { html, css, title } from a @graview/pages/static entry, running in Node with no DOM"
  - "Renders a list, a record, a place and the home page as self-contained static HTML with the app's look, no scripts, under the viewer's sight"
  - "Printable: page breaks between sections; the describe line and the card as on the page"
  - "The entry is listed in exports and the pack inspection; a test renders each page kind of apps/todo without a DOM"
  - "A changeset with a Compatibility line names FR-174"
description: "@graview/pages exports React components and a browser router; nothing renders a place to a string. Cloud wants a fixed link (a schedule as a PDF, a roster) re-rendered when the app changes, in a Worker without a DOM. Roadmap f-pages-static-render; unblocks f-live-documents and f-scheduled-sends."
---
