---
id: "1568db6c-9752-428a-b840-9a11dc84cf13"
type: "capability"
title: "An edit can set a kind's glance (set-glance), and the studio renames display.glance with its field"
slug: "an-edit-can-set-a-kind-s-glance-set"
statement: "An edit to a Graview document can set a kind's glance directly, and renaming a field in the studio carries the rename into display.glance."
criteria: [{"id":"c1","text":"When an edit sets a kind's glance with the set-glance op, editDocument shall check the field names given like any other name."},{"id":"c2","text":"When a field is renamed in the studio, the studio shall rename it in the kind's display.glance."}]
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
priority: "low"
---

FR-39 follow-ups: a model using editDocument cannot set a glance directly, and the studio's own rename path keeps display.glance by hand.
