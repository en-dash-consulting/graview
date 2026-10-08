---
id: "d3767ab0-0283-4c31-b6e5-21ca7db2e8a4"
level: "feature"
title: "Record-page field order and grouping can be set (FR-148)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-148"
  - "design"
  - "document-format"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
completedAt: "2026-10-08T22:44:02.000Z"
endedAt: "2026-10-08T22:44:02.000Z"
acceptanceCriteria:
  - "The record page follows the kind's declared field order by default"
  - "A document edit (set-page-fields or similar) sets the first fields and groups, the rest under Details"
  - "Previews, applies and rolls back through editDocument"
description: "The record page shows Status, Summary, Due, Draft, Subject: neither declaration order nor alphabetical, and nothing sets it."
lastModified: "2026-10-08T22:44:02.000Z"
resolution: "Shipped in #158, merged through #162 (0.1.18): a record's facts read in the kind's declared order, or the order kinds.<kind>.page says, under its headings; set-page-fields edits it."
---
