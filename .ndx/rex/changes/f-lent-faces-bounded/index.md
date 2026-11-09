---
id: "4e98b404-e713-4e8a-8405-ed553df01cf6"
type: "change"
title: "A face a brand lends its views has a size it may not pass, and two of one family say which draws"
slug: "f-lent-faces-bounded"
intent: "Left from PR #532. A lent face loads eagerly with no byte limit, because `FontFace` gives nothing to cap with; only a host or a CDN can, or `fetch` would have to replace it. Two faces of one family with different files both stay in the document, and which draws was not measured; it matters only if two brands share a document. One unexplained WebKit sighting of `error` on a face right after another was deleted."
acceptanceCriteria:
  - "A lent face past a stated size is not loaded and the view and the host are told in words (test)"
  - "Two lent faces of one family in one document resolve deterministically, and a test says which draws"
  - "The view-drawing skill states the limit"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "low"
tags:
  - "graview"
  - "guest"
  - "fonts"
  - "hq:feature:f-lent-faces-bounded"
source: "Graview HQ feature:f-lent-faces-bounded"
---
