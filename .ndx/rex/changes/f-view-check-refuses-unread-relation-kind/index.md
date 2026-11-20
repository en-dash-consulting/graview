---
id: "237d0234-c5da-4784-b9d9-921d2d72ce86"
type: "change"
title: "A view whose manifest misses a kind its relations read is refused when it is proposed, and one standing problem is said once"
slug: "f-view-check-refuses-unread-relation-kind"
intent: "From Cloud's brief after 0.2.7 (HQ feature:f-view-check-refuses-unread-relation-kind, the framework half of feature:f-view-reads-kinds-gap-in-user-app): a view that reads a relation whose far kind its manifest's reads.kinds lacks is applied today and then reported at every open, so people filed the same problem as feedback once per app version. Refuse it before it is applied, and give a standing view problem a stable key so a host files it once."
acceptanceCriteria:
  - "Proposing or checking a view that reads a relation whose far kind is missing from reads.kinds refuses it, naming the relation and the kind to add (test)"
  - "A view the same check passes today still passes (test)"
  - "The problem a page reports for a standing view fault carries a stable key of view, relation and kind, the same across app versions (test)"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-view-check-refuses-unread-relation-kind"
source: "Graview HQ feature:f-view-check-refuses-unread-relation-kind"
---
