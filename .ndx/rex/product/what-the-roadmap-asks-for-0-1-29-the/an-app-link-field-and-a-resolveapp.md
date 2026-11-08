---
id: "f209f0a0-f237-4a26-ab9f-956377d0a753"
type: "capability"
title: "An app-link field and a resolveApp seam: the first step to cross-app links (FR-171)"
slug: "an-app-link-field-and-a-resolveapp"
statement: "An app-link field lets a record hold the address of another app, which the product draws as that app's name, icon and home headline when the host supplies a resolver and opens it, or as the plain address when no resolver is given."
criteria: [{"id":"c1","text":"The system shall offer an app-link field type, whose value names another app by address, in FIELD_TYPES, the schema, the checker and editDocument's add-field."},{"id":"c2","text":"When a host passes resolveApp(address, viewer) on mount, an app-link field shall draw as the linked app's name, icon and home headline, not a raw URL, and shall open that app."},{"id":"c3","text":"If the host says a viewer may not open the linked app, the app-link field shall draw 'linked app (no access)' for that viewer and shall not show the app's contents."},{"id":"c4","text":"While no resolveApp resolver is passed, an app-link field shall draw as its address, plainly."}]
tags:
  - "roadmap"
  - "f-cross-app-links"
  - "FR-171"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "medium"
resolution: "Shipped on feat/fr-171-app-link-field: an app-link field type (document, appLinkField(), schema, check, editDocument, forms, tool schema, graview types) and a host's resolveApp(address, viewer) on mount, <Embed>, GraviewProvider and the routed face, drawn as the app's icon, name and home headline on a record's page, a row, a card and the scene's record panel, 'linked app (no access)' when refused and the address plainly without a resolver; the cross-document relation is left for 0.2."
---

A relation's to is kind names in one document and FIELD_TYPES has no reference to another app. The cheaper first step, acceptable on its own: an app-link field. Roadmap f-cross-app-links; Cloud's half is f-cross-app-links-cloud.
