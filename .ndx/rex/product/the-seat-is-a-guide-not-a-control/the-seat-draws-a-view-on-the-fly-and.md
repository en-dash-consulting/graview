---
id: "e7d433e2-8130-44d8-a327-c325ace39937"
type: "capability"
title: "The seat draws a view on the fly, and keeps it as a lens"
slug: "the-seat-draws-a-view-on-the-fly-and"
statement: "The seat drafts a view on the fly from a request for a way of seeing, shows it live on the app's data in the guest sandbox, and keeps it as a named lens in the declaration when asked."
criteria: [{"id":"c1","text":"When asked for a way of seeing, the seat shall draft a view quickly and show it in place."},{"id":"c2","text":"When drafting a view, the seat shall prefer a declared-block view or a role-bound lens over arbitrary code, and a worker view only when needed."},{"id":"c3","text":"The seat shall run every drafted view in the guest sandbox under the seat's sight."},{"id":"c4","text":"While a draft is shown, the seat shall keep it live on the app's data."},{"id":"c5","text":"When asked to refine a draft (for example 'group by owner' or 'only this month'), the seat shall revise the draft accordingly."},{"id":"c6","text":"When asked to keep a draft as a lens, the seat shall save it into the declaration as a named picture or lens through the ordinary document edits, previewed, checked by graview check and undoable."},{"id":"c7","text":"When a draft has been kept as a lens, the product shall list it in the place list and in the scene's control."},{"id":"c8","text":"If a draft fails to compile or render, the seat shall say so in one line and offer the last good version."},{"id":"c9","text":"A drafted view shall write to the app only through declared acts."},{"id":"c10","text":"The seat shall show a first draft within a few seconds on a template app."},{"id":"c11","text":"When a draft is saved as a lens, the resulting declaration shall be one that graview check accepts."}]
tags:
  - "seat"
  - "views"
  - "lenses"
  - "intelligence"
source: "Nick, 2026-10-08: \"i want 'the seat' interface changed in both Pages and Scene views. i want it to be more floating and less of a 'heres everything you can do with the selected node' and more open to experiences with less noise (right now the interface is really unclear, all the action names are weird, and so many buttons/options). I want it to help me navigate through the graview app, but also as an additional bit of making it so adaptive, is i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens\""
priority: "high"
resolution: "Shipped in #165 and #169: @graview/tools/draft drafts template or model lenses judged as declared lenses, refined by asking, drawn over the picture or at /~draft; Keep through onKeepLens (add-lens) or as the reader's own; Take back; draft_view and keep_lens tools."
---

Nick: 'i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens'. Builds on views as data, worker views, FR-149/150 views beside editing, and the intelligence seam.
