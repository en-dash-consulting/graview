---
id: "d8e07658-df54-4fea-887a-6af6eebd1928"
type: "capability"
title: "A host can ask up front what the studio will not edit: uneditable(document) (FR-62)"
slug: "a-host-can-ask-up-front-what-the"
statement: "Cloud copies the studio's rule (a format, a unit, a list's item type) into studioLeaves in workers/cloud/src/builder.ts to warn before anyone tries."
criteria: [{"id":"c1","text":"@graview/studio shall export uneditable(document), which returns one finding per field property the studio keeps but will not change."},{"id":"c2","text":"When uneditable(document) is given the vendors fixture, @graview/studio shall name kinds.vendor.fields.quote and kinds.category.fields.budget among its findings."}]
tags:
  - "graview-cloud"
  - "FR-62"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "low"
---

Cloud copies the studio's rule (a format, a unit, a list's item type) into studioLeaves in workers/cloud/src/builder.ts to warn before anyone tries.
