---
id: "e8e7e194-3e70-4bc6-bb58-c3abb0418162"
type: "change"
title: "An add a host hands the store keeps none of its payload's record times in the log"
slug: "f-received-add-drops-payload-touches"
intent: "From Cloud via HQ feature:f-received-add-drops-payload-touches: a remix's seed op carried the source app's createdAt, createdBy, updatedAt and updatedBy in its add-node payloads. The fold already stamps a non-undo add with its own op (makingIn), so the record is right, but the kept op still carries the source's four and is served as is to a seat told them. Strip the four from add-node payloads of an op with no undoes before it is kept, on every door an op enters the store (receive, apply, a host's ops), so the log, history, exports and pushes never carry another app's stamps. An undo's put-back keeps its payload's four. Private until built; public text neutral."
acceptanceCriteria:
  - "An op with no undoes whose add-node carries the four is kept, served and exported without them, and the record is stamped by the op (test)"
  - "An undo that puts a record back keeps its payload's four (test)"
  - "A remove-then-add in one op (a kind renamed) keeps what its removal carried (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-received-add-drops-payload-touches"
source: "Graview HQ feature:f-received-add-drops-payload-touches"
---
