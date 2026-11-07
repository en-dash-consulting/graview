---
id: "de91edf4-2661-45a3-a5b4-7eddffab533e"
type: "capability"
title: "Room on the hosted page: weight by entry in release notes, and headroom under 600 KB (FR-104)"
slug: "room-on-the-hosted-page-weight-by"
statement: "The release notes give the weight of the hosted page's entry by package, and the hosted page loads below 600 KB up front with headroom stated."
criteria: [{"id":"c1","text":"The release notes shall give the weight of the hosted page's entry broken down by package."},{"id":"c2","text":"The hosted page shall load below 600 KB up front, with the headroom under that figure stated."},{"id":"c3","text":"The hosted page shall defer to lazy loading what a reader does not need first, such as the Scene's layout on a Pages visit, describe/check code and zod at the face's top level, unless the budget is deliberately changed."}]
tags:
  - "graview-cloud"
  - "FR-104"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "high"
---

Cloud's shell loads 623 KB before anything draws; 596 KB is the framework's page against a stated 600.
