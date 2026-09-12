---
id: "4a0045cc-f380-4618-9faa-3cbd340d7632"
level: "feature"
title: "Studio: the declaration itself, edited in the graph's own interface, with changes applied as mutations"
status: "pending"
priority: "high"
tags:
  - "studio"
  - "creator"
  - "schema"
  - "platform"
blockedBy:
  - "b04b600e-401f-49a1-97a0-a8539408dd70"
  - "d5fff728-2b2d-446f-a036-d47227828bfa"
source: "Nick, 2026-09-12 (/ndx-capture): \"there needs to be a studio/creator mode or something. basically a web ui for the schema/etc that comprise the context graph, and apply a mutation from changes and whatnot\""
acceptanceCriteria:
  - "the declaration is a graph the scene and the pages can show: kinds, fields, edges, acts, rules, policy, brand and lenses as nodes with their relations"
  - "every change to the declaration is a mutation with an author, intent and inverse, and undo works on it"
  - "graview check runs on the proposed declaration and its findings are shown before a change is applied"
  - "an applied change reaches the running app and, where the stored graph needs it, produces a migration"
  - "the declaration can be written back as the same files graview create writes, and a checkout built from them passes its own verify"
  - "an agent seat can propose a declaration change and a person can accept it in the studio"
description: "A creator mode where the context graph's own declaration — kinds, fields, edges with both readings, acts, rules and their repairs, the policy, the brand, the lenses — is a graph you can see and edit in Graview's own interface, in the browser. The meta-schema is declared with the same defineNode/defineMutation the apps use, so the studio is a Graview app over the declaration: adding a field is an act, renaming a kind is an act, every change is an op with an author, an intent and an inverse, and graview check runs on the result before it is applied. Changes are applied as mutations to the running declaration (a migration where the stored graph needs one), and the result can be written back as code (the scaffold's generator already produces the files) so the studio and the checkout never disagree. This is the seam graview-cloud's app-from-declaration needs, and the natural home for working the declaration with an agent: the seat proposes a kind, the studio shows it, the person accepts it."
lastModified: "2026-09-12T15:02:03.195Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
