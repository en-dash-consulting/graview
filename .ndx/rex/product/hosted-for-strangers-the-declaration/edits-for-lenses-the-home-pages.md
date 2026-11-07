---
id: "4082d14f-4b19-4b95-83f2-aacf8317e35e"
type: "capability"
title: "Edits for lenses, the home, pages, computed fields and the new blocks (FR-84)"
slug: "edits-for-lenses-the-home-pages"
statement: "Cloud's propose_change offers edits for lenses, the home, pages, computed fields and the new blocks, each previewed, applied and rolled back like the existing edit operations."
criteria: [{"id":"c1","text":"The edit operations shall include add-lens, remove-lens, set-home, arrange-pages and set-computed, plus set-view for the new blocks, each with diff sentences."},{"id":"c2","text":"When a kind is renamed or removed, the edit operations shall rewrite the lens, home, page, computed-field and view edits that refer to it."},{"id":"c3","text":"Each of the new edit operations shall preview, apply and roll back through editDocument and diffDocuments in the same way as the existing edit operations."}]
tags:
  - "graview-cloud"
  - "FR-84"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "medium"
---

Cloud's propose_change needs ops for everything FR-79 to FR-83 adds.
