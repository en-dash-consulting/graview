---
id: "e606dd4c-7182-41b0-a06a-54be828de2b7"
type: "capability"
title: "The views guide says the real props shape, with a worked example (FR-151)"
slug: "the-views-guide-says-the-real-props"
statement: "The views guide describes a view's props as the code hands them over, with field values on the node itself, and teaches this with a worked example."
criteria: [{"id":"c1","text":"Every place that documents a view's props shall state that field values sit on the node itself and that there is no fields key."},{"id":"c2","text":"The views guide shall include a tested worked example of a cardinality-one view that reads its own record's fields."}]
tags:
  - "graview-cloud"
  - "FR-151"
  - "docs"
  - "views"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
priority: "high"
resolution: "Shipped in #157, merged through #162 (0.1.18): the views guide says the props a view is handed, with a worked example of one record."
---

A view written to the guide's props.nodes[].fields renders empty.
