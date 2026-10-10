---
id: "f8da2a4b-5370-4f05-ba05-6df07ca192ad"
level: "feature"
title: "A connect that replaces replaces the link it should (FR-156)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-156"
  - "document"
  - "acts"
source: "Graview Cloud, 2026-10-09 (found on production 0.1.18, a private pricing-model app, via the Claude connector)"
startedAt: "2026-10-10T02:28:45.000Z"
completedAt: "2026-10-10T02:28:45.000Z"
endedAt: "2026-10-10T02:28:45.000Z"
acceptanceCriteria:
  - "A declared act with connects and replaces: true, on a relation of one, run on a record that already has a link of it, severs that link and makes the new one, as one act, one batch and one undo"
  - "It does so by apply, applyAll, preview, previewAll, the act's tool and preview_mutation"
  - "A relation declared from the far kind, a relation of many, replaces naming several relations, and two acts on one relation in a batch each do what replaces says"
  - "Refusals, their reasons and permissions are unchanged"
description: "replaces: true on a connects act was refused \"Cannot remove missing edge\" whenever the record already had the link it was meant to replace: replaces and the cardinality-one connect each planned the same removal from the graph as it stood before the act."
lastModified: "2026-10-10T02:28:45.000Z"
resolution: "Fixed in PR_PENDING: a declared act severs a link once however many of its effects ask it to."
---
