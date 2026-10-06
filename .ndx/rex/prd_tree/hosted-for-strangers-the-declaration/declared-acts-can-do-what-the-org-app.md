---
id: "369257a0-22a8-471f-85dd-eee0e8bfcf78"
level: "feature"
title: "Declared acts can do what the org app's mutations do: set the other end, replace links, choose by condition (FR-115)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-115"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
startedAt: "2026-10-06T22:10:36.000Z"
completedAt: "2026-10-06T22:10:36.000Z"
endedAt: "2026-10-06T22:10:36.000Z"
acceptanceCriteria:
  - "(a) sets on the other end of a connects (e.g. setsOther: { status: owned }); (b) replaces: true on a connects severs the subject's existing links of that edge first; (c) if(cond, a, b) (or either) allowed in sets values; each previewed, diffed and undoable"
  - "assign-ownership and propose-owner from org-graview are each one declared act, behaving as the TypeScript mutations do on the org seed"
description: "assign-ownership and propose-owner each had to be split into a link act and a status act that a person runs both of."
lastModified: "2026-10-06T22:10:36.000Z"
---
