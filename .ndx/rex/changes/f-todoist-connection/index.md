---
id: "88bc77e7-21c6-465c-9e65-69ea05196b8b"
type: "change"
title: "Todoist, synced both ways through an API token"
slug: "f-todoist-connection"
intent: "From HQ feature:f-todoist-connection: A todoist system beside google-calendar and notion in a document's connections, run by graview serve and a host's runConnections. It maps a Todoist project (or a section or label of it) to a kind: content, description, due date (date or datetime, recurring), deadline, priority, labels, section, assignee, parent task and completed. Both ways through SyncEngine: pulls since the last sync token, pushes creates, edits, completions and removals, its own writes not echoed, conflicts held, rate limits waited out. A task completed there maps to a field, never to a removed record. Subtasks as links where both ends are synced. A personal API token read from the host's secrets, never written to the document or the op log; OAuth is the host's. Settle at build: the current API version and limits, and how recurring due strings map onto repeats."
acceptanceCriteria:
  - "A declared Todoist connection keeps a kind in step both ways against a scripted Todoist, and its first run sends nothing (test)"
  - "A conflict is held, our own writes are not echoed back, and a 429 is waited out (test)"
  - "A task completed in Todoist sets a field and removes no record (test)"
  - "graview check refuses a mapping to a field that cannot hold it, and document.schema.json carries the shape (test)"
  - "The token is in no document and no op (test)"
  - "scripts/verify-todoist.mjs runs the same against a real account, out of CI"
priority: "high"
tags:
  - "graview"
  - "core"
  - "ship"
  - "sync"
  - "hq:feature:f-todoist-connection"
source: "Graview HQ feature:f-todoist-connection"
---
