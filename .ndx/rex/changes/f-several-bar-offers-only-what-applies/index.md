---
id: "6f17d38a-9e75-4f6a-9b9d-12f9e6e6991c"
type: "change"
title: "The several bar offers an act only for records it can apply to, and says a refusal in words"
slug: "f-several-bar-offers-only-what-applies"
intent: "Found reviewing per-viewer state (PR #534), present on main since 0.1.68. `actsForSeveral` (`packages/tools/src/several.ts`, used by `primitives/src/several-bar.tsx`) offers `take-back` when several records are chosen, whoever holds the link. A seat with no vote on them is refused each with `Cannot remove missing edge votedBy\\0idea:a\\0p_ann`, which holds internal ids. A list of acts with no record to judge against (`permittedMutations`) has the same shape for agents and for a worker view that declares the act."
acceptanceCriteria:
  - "The several bar offers an act only when the rehearsal actOnSeveral already runs would apply it to at least one chosen record, and counts only those (test)"
  - "An edge removal on a record that lacks the edge is refused in words with no internal id or NUL-joined key, wherever such a refusal can reach a person or an agent (test)"
  - "The browser harness that drives the several bar holds a claim that no offered act is then refused"
touches:
  - "dd0e99fc-d01d-4a2d-ba1d-af9b10d8b6e4"
priority: "medium"
tags:
  - "graview"
  - "tools"
  - "primitives"
  - "hq:feature:f-several-bar-offers-only-what-applies"
source: "Graview HQ feature:f-several-bar-offers-only-what-applies"
---
