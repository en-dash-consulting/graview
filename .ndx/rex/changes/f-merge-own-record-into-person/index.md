---
id: "d6ab25ce-55bc-4bb8-b270-fbc4843b4034"
type: "change"
title: "The host merges a member's own record into the People record they are linked to"
slug: "f-merge-own-record-into-person"
intent: "From Cloud's People area (brief b-cloud-2026-11-18-merge-own-record). bindPerson refuses an account that already has its own record in the app and says to merge the two, but the framework has no merge. Every invited member gets their own record on joining, and anyone with a role gets one on first open, so in practice only people who never opened the app can be linked. Ask: a host-only (the host's system seat) merge that binds the seat to the named People record and folds the member's own record into it, its acts re-attributed, its links moved and the own record retired, as one undoable change, the same shape as f-rebind-after-acting's move of acts. Private until built; public text neutral."
acceptanceCriteria:
  - "The host's system seat merges a member's own record into a named unbound People record: the seat is bound to it, every act made as the own record names the People record, and links to the own record move to it (test)"
  - "The own record is retired, not left as a second person (test)"
  - "The merge is one change: undo restores the own record, its links, its acts' attribution and the binding (test)"
  - "Any other seat is refused, and bindPerson's refusal names the merge (test)"
  - "graview check knows the act (test)"
priority: "high"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-merge-own-record-into-person"
source: "Graview HQ feature:f-merge-own-record-into-person"
---
