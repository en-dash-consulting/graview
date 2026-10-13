---
id: "f209f0a0-f237-4a26-ab9f-956377d0a753"
level: "feature"
title: "An app-link field and a resolveApp seam: the first step to cross-app links (FR-171)"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "f-cross-app-links"
  - "FR-171"
startedAt: "2026-10-13T03:05:00.000Z"
completedAt: "2026-10-13T04:10:00.000Z"
endedAt: "2026-10-13T04:10:00.000Z"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "An app-link field type whose value names another app by address, in FIELD_TYPES, the schema, the checker and editDocument's add-field"
  - "A host passes resolveApp(address, viewer) on mount; the field draws as that app's name, icon and home headline, not a raw URL, and opens it"
  - "A viewer the host says may not open it sees 'linked app (no access)', never its contents"
  - "Without a resolver the field draws as its address, plainly"
  - "A changeset with a Compatibility line names FR-171; the full cross-document relation is left for 0.2 and said so"
description: "A relation's to is kind names in one document and FIELD_TYPES has no reference to another app. The cheaper first step, acceptable on its own: an app-link field. Roadmap f-cross-app-links; Cloud's half is f-cross-app-links-cloud."
resolution: "Shipped on feat/fr-171-app-link-field: an app-link field type (document, appLinkField(), schema, check, editDocument, forms, tool schema, graview types) and a host's resolveApp(address, viewer) on mount, <Embed>, GraviewProvider and the routed face, drawn as the app's icon, name and home headline on a record's page, a row, a card and the scene's record panel, 'linked app (no access)' when refused and the address plainly without a resolver; the cross-document relation is left for 0.2."
lastModified: "2026-10-13T04:10:00.000Z"
---
