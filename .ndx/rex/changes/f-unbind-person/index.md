---
id: "01616e5a-4b88-44ec-80fd-f9bf607f4ac2"
type: "change"
title: "An unbind for a bound person, and a binding that ends with the seat's role"
slug: "f-unbind-person"
intent: "From Cloud's owner Undo for invite-as (2026-11-11): an owner can take back a binding made by mistake after the record was edited, said in plain words, and a host can end a seat's binding while its history keeps its attribution. Security and reliability details are in a private brief."
acceptanceCriteria:
  - "An owner unbinds a seat that never acted as the record, after others edited it (test)"
  - "A refused unbind says why in words, naming no op or batch id (test)"
  - "A host ends a seat's binding: the seat is no longer that record, and its past ops keep their attribution (test)"
touches:
  - "83796ab4-ebd4-48f4-ad70-81121f49d17d"
priority: "high"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-unbind-person"
source: "Graview HQ feature:f-unbind-person"
---
