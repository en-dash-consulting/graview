---
id: "a2763f5d-2ee2-4085-bcf7-507852f30ae5"
level: "task"
title: "A create can name its id, and every kind gets a policy-gated derived remove act"
status: "completed"
priority: "critical"
blockedBy:
  - "286f8662-3524-451a-a855-b4afed3ef0e4"
startedAt: "2026-09-28T20:12:34.611Z"
completedAt: "2026-09-28T20:12:34.611Z"
endedAt: "2026-09-28T20:12:34.611Z"
resolutionType: "code-change"
resolutionDetail: "compileMutation lifts an optional `id` for acts declaring `creates` (takesAnId), freshId hands it out first and refuses a taken id by name; mutationToolSchema shows it. deriveRemoveMutations gives every kind `remove-<kind>` (destructive, removes ties, undoable) permitted via the kind's creators (removeVia) or a grant; `derived` is `{ kind, act }`; store/check/describe/docs count the removes. agents.md and node-kind/permissions skills say roles over hardcoded ids. Test what-was-made-can-be-unmade.test.ts. Commit bee1801."
acceptanceCriteria:
  - "An act declaring creates accepts an optional id argument; the node it makes carries that id and the tool schema shows the argument; an id already in the graph is refused by name rather than suffixed"
  - "remove-<kind> is derived for every kind without a declared act of that name: destructive, titled, removes the node and its edges, logged and undoable; an app's own remove-<kind> is kept"
  - "Permission resolves through the acts that create the kind or a grant naming it; the refusal names who could"
  - "graview check, describe and docs all list the derived removes with the derived edits; the store's permittedMutations narrows an agent seat's tool list accordingly"
  - "agents.md and the graview-node-kind / graview-permissions skills say: bind roles and flags, never hardcode bootstrap ids in mutation bodies or invariants"
description: "Redesign and seed-to-live sync need deterministic ids and deletion; today freshId mints from the label and nothing removes, which pushes agents to rewrite the seed. Any act that declares creates accepts an optional id argument naming the node it makes (refused if taken, never silently suffixed), surfaced in the tool schema. remove-<kind> is derived per kind beside edit-<kind>: destructive, titled, logged, undoable, and permitted through the acts that create the kind or a grant naming it. Apps are told, in the generated agents.md and the skills, not to hardcode bootstrap ids in mutation bodies or invariants: bind roles and flags instead."
lastModified: "2026-09-28T20:12:34.680Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
