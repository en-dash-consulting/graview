---
id: "6417c5e0-8830-46f2-bc5e-3f330f9ac707"
type: "capability"
title: "A view's navigate takes only a string"
slug: "a-view-s-navigate-takes-only-a-string"
statement: "A view's navigate accepts only a string destination, and the host refuses anything else quietly while still counting it against the flood allowance."
criteria: [{"id":"c1","text":"When a view's navigate carries a to or place that is not a string (an object, a number), the host shall refuse it without a sentence and shall not call onProblem."},{"id":"c2","text":"When a navigate destination goes nowhere, the host shall quote it in the sentence given to the host and in a headless run's problems at no more than 80 characters, ending with an ellipsis when it is shortened."},{"id":"c3","text":"The host shall count every navigate, lost or refused, against the flood allowance."}]
tags:
  - "roadmap"
  - "f-view-links-framework"
source: "Follow-up to #233: review of the worker view's navigate"
priority: "high"
resolution: "Shipped in #235: a navigate whose to or place is no string is refused without a sentence, and one that goes nowhere quotes at most 80 characters of it, ending with an ellipsis, in the host's sentence and a headless run's problems; every navigate still counts against the flood allowance."
---

packages/guest host/view.ts: given.onmessage handed data.to from the untrusted worker to links.go without a type check, so options.sees and the nowhere() sentence took anything the worker sent, and that sentence reaches the host's onProblem and from there Cloud's problems list at any length.
