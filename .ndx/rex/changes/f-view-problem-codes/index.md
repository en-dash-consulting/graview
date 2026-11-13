---
id: "c66df9f9-c910-4424-90d7-87e56a163dad"
type: "change"
title: "A view's onProblem says a code beside its sentence"
slug: "f-view-problem-codes"
intent: "Cloud counts view problems (ViewPartFailed / ViewHeld) by matching the framework's English sentences from onProblem (mountWorkerView, mountGuestView, guestView, createGuestHost onHeld). Ask: a stable code (part-failed, held-by-growth-guard, face-not-lent, ...) and the part name where there is one, beside the sentence."
acceptanceCriteria:
  - "Every problem onProblem reports carries a code from a closed exported list, and a part name when a part failed (test)"
  - "Changing a problem's sentence does not change its code (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "primitives"
  - "hq:feature:f-view-problem-codes"
source: "Graview HQ feature:f-view-problem-codes"
---
