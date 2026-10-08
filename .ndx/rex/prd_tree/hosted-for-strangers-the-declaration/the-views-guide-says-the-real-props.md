---
id: "e606dd4c-7182-41b0-a06a-54be828de2b7"
level: "feature"
title: "The views guide says the real props shape, with a worked example (FR-151)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-151"
  - "docs"
  - "views"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
startedAt: "2026-10-08T21:00:00.000Z"
completedAt: "2026-10-08T21:00:00.000Z"
endedAt: "2026-10-08T21:00:00.000Z"
acceptanceCriteria:
  - "Every place that documents a view's props says what the code hands it (field values on the node itself, no fields key)"
  - "A tested worked example of a cardinality-one view that reads its own record's fields"
description: "A view written to the guide's props.nodes[].fields renders empty."
lastModified: "2026-10-08T21:00:00.000Z"
resolution: "Shipped in #157, merged through #162 (0.1.18): the views guide says the props a view is handed, with a worked example of one record."
---
