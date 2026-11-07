---
id: "a2763f5d-2ee2-4085-bcf7-507852f30ae5"
type: "task"
title: "A create can name its id, and every kind gets a policy-gated derived remove act"
slug: "a-create-can-name-its-id-and-every"
description: "Redesign and seed-to-live sync need deterministic ids and deletion; today freshId mints from the label and nothing removes, which pushes agents to rewrite the seed. Any act that declares creates accepts an optional id argument naming the node it makes (refused if taken, never silently suffixed), surfaced in the tool schema. remove-<kind> is derived per kind beside edit-<kind>: destructive, titled, logged, undoable, and permitted through the acts that create the kind or a grant naming it. Apps are told, in the generated agents.md and the skills, not to hardcode bootstrap ids in mutation bodies or invariants: bind roles and flags instead."
acceptanceCriteria:
  - "An act declaring creates accepts an optional id argument; the node it makes carries that id and the tool schema shows the argument; an id already in the graph is refused by name rather than suffixed"
  - "remove-<kind> is derived for every kind without a declared act of that name: destructive, titled, removes the node and its edges, logged and undoable; an app's own remove-<kind> is kept"
  - "Permission resolves through the acts that create the kind or a grant naming it; the refusal names who could"
  - "graview check, describe and docs all list the derived removes with the derived edits; the store's permittedMutations narrows an agent seat's tool list accordingly"
  - "agents.md and the graview-node-kind / graview-permissions skills say: bind roles and flags, never hardcode bootstrap ids in mutation bodies or invariants"
priority: "critical"
blockedBy:
  - "286f8662-3524-451a-a855-b4afed3ef0e4"
---
