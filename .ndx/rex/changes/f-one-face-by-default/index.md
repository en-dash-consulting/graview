---
id: "e8d4d89a-4e1b-4b34-a5ec-dd63086afb21"
type: "change"
title: "The one face is what ships: on by default, and what graview create, the example and the docs teach"
slug: "f-one-face-by-default"
intent: "From HQ feature:f-one-face-by-default (Nick, 2026-11-26): the published docs still teach the two-face construct (the Scene at /, the pages at /pages, 'both faces'), and the one face should be what ships by default. 0.2.0 shipped it opt-in (sceneUnderPages) and planned the default for 0.2.1 (docs/pages-and-lenses-are-one.md, one-face-by-default), which never landed. Make the one face the default for a routed face that owns its page, keep sceneUnderPages: false as a host's way out, have graview create and apps/todo write one PagesApp at / on the one face, move or retire the routed-face tests that held the pre-city page, and rewrite the skills, site pages, READMEs and walkthrough to teach Page, Nearby and Map. The embed still draws the routed face in a box and says so."
acceptanceCriteria:
  - "A routed face that owns its page draws the one face when no option is given, and sceneUnderPages: false draws the routed face alone (test)"
  - "graview create writes one PagesApp at / on the one face, with no /pages split and no Scene-at-root entry, and smoke:create opens it on the one face (test, smoke)"
  - "apps/todo opens on the one face at / (harness)"
  - "No skill and no docs page teaches two faces, a pages face or a Scene face where the one face is meant (test)"
  - "The routed-face unit tests and hosted budgets hold on the one face, or are retired with the reason said (test)"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "embed"
  - "core"
  - "skills"
  - "site"
  - "hq:feature:f-one-face-by-default"
source: "Graview HQ feature:f-one-face-by-default"
---
