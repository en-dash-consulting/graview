---
id: "4f52ef1f-0f30-41d0-8cc2-b3bd8f11fef4"
type: "change"
title: "A view chooses its pictures by record, or is handed addresses that load when drawn"
slug: "f-view-pictures-by-record"
intent: "Cloud, 2026-11-10: a worker view's pictures are chosen by kind or field, so a view of one champion among 820 drivers is handed every driver photo, past the 12 MB limit, and the needed one is dropped. Ask: choose pictures by record ids or a cap, or hand addresses that load only when drawn."
acceptanceCriteria:
  - "A view's manifest can name pictures by record (ids or the records it draws) and a cap, and only those are handed (unit test)"
  - "A view of one record among 820 with photos is handed that record's picture within the limit (test)"
  - "The view-drawing skill and docs say how; graview check refuses a malformed choice"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest pictures"
  - "hq:feature:f-view-pictures-by-record"
source: "Graview HQ feature:f-view-pictures-by-record"
---
