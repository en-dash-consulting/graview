---
id: "07c7eb90-7198-457f-b90b-38aa1d27adf0"
level: "feature"
title: "A served change's intent sentence follows sight"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "request:visibility-scoped-by-relation-see-records-linked-to-me"
source: "Follow-up to #234: review of what a seat is told of a change it may see only part of"
startedAt: "2026-10-12T15:45:00.000Z"
completedAt: "2026-10-12T17:10:00.000Z"
endedAt: "2026-10-12T17:10:00.000Z"
acceptanceCriteria:
  - "An answer to a change whose every written record is outside the seat's sight says only \"A change you cannot see\""
  - "An answer to a change the seat sees part of is said from the ops it is served; a caller's sentence for a batch is not served on a batch the seat sees only part of, in the answer, the served log, since, the activity rail or history"
  - "A preview judges a record it would make by its kind and the links it gives it"
  - "Covered for a via sight (Secret Santa), an own sight and sees hiding a whole kind; a seat that sees everything gets the intent verbatim"
  - "Hosted page: no growth up front"
description: "answerSeenBy redacted a change's ops and diff to the seat's sight but passed its top-level intent through when the seat could not see what the change made (\"Draw a match: Ann gives to Bo\" to a participant who may not see that match), and a batch's caller intent rode on every served op of a batch the seat saw only part of."
resolution: "Shipped in #237: a change the seat sees none of says only \"A change you cannot see\", one it sees part of is said from the ops it is served, a batch's caller sentence is left off a log the seat sees only part of, and a preview judges what it would make by kind and links; answerSeenBy moved to @graview/core/answer, 1,694 bytes off the hosted page's first load."
lastModified: "2026-10-12T17:10:00.000Z"
---
