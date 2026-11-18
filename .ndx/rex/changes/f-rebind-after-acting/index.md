---
id: "42ed8ff5-8ef9-4b21-9042-6bd9a7db7499"
type: "change"
title: "An owner can move a person from the wrong record to the right one after they have acted"
slug: "f-rebind-after-acting"
intent: "Left open by PR #613 (f-unbind-person), 2026-11-16: once a seat has acted as a record, undoing the binding is refused, and after an ending neither the seat nor the record can be bound again, so a binding to the wrong record can never be corrected. Decided by Nick 2026-11-16: move their acts. The host's system seat re-binds the person to the right record, and the seat's past acts are attributed to that record, as one change that undo takes back; the wrong record goes back to unbound."
acceptanceCriteria:
  - "The host's system seat re-binds a person who has acted to another unbound record, and every act the seat made as the old record now names the new one (test: a-rebind-moves-the-acts)"
  - "The old record is unbound afterwards and may be bound again (test)"
  - "The re-bind is one change: undo restores the old binding and the old attribution (test)"
  - "Any other seat is refused the re-bind, and graview check knows the act (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-rebind-after-acting"
source: "Graview HQ feature:f-rebind-after-acting"
---
