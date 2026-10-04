---
id: "c3cd621b-8928-49fd-945a-edfd3100e439"
level: "feature"
title: "The studio says the host refused when it did: onApply can answer with findings (FR-60)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-60"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
acceptanceCriteria:
  - "onApply may return { ok: false, findings }; the studio then shows those findings in its applied panel and stays open with the edits intact"
  - "The studio no longer says 'Handed to the host to keep' when the host refused"
description: "onApply returns nothing, so with documentFindings present the studio still says 'The checker is happy. Handed to the host to keep' while the host previews nothing."
lastModified: "2026-10-04T14:38:55.737Z"
---
