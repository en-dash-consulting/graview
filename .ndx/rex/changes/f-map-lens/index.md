---
id: "f7f4d287-b09a-41de-b571-276a80a9adfc"
type: "change"
title: "A map lens: records pinned by their place field, with filters and a tap through to the record"
slug: "f-map-lens"
intent: "From HQ feature:f-map-lens (framework half; geocoding is the host's): a shipped map lens that pins a kind by its coordinates (a lat/lng pair or a place field the host geocoded into lat/lng), with filters and a tap through to the record, drawn without outside tiles (an inline projection, the host may hand a tile source); and geocoded lat/lng behind place fields that views can read."
acceptanceCriteria:
  - "A map lens declared over a kind with coordinates draws one pin per record and a tap opens the record (test and a harness claim)"
  - "Records with no coordinates are said, not dropped silently (test)"
  - "graview check refuses a map lens over a kind with no coordinates (test)"
  - "A view can read a place field's lat/lng when the host gave them (test)"
priority: "medium"
tags:
  - "graview"
  - "primitives"
  - "render"
  - "core"
  - "hq:feature:f-map-lens"
source: "Graview HQ feature:f-map-lens"
---
