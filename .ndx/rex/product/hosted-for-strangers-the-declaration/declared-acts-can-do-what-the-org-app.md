---
id: "369257a0-22a8-471f-85dd-eee0e8bfcf78"
type: "capability"
title: "Declared acts can do what the org app's mutations do: set the other end, replace links, choose by condition (FR-115)"
slug: "declared-acts-can-do-what-the-org-app"
statement: "Declared acts can set the other end of a connects, replace a subject's existing links of an edge, and choose a value by condition, so one declared act does what the org app's TypeScript mutations do."
criteria: [{"id":"c1","text":"When a declared act connects an edge with setsOther, the act shall set the stated field values (e.g. status: owned) on the other end of the connection."},{"id":"c2","text":"When a declared act connects an edge with replaces: true, the act shall first sever the subject's existing links of that edge."},{"id":"c3","text":"Where a declared act sets a value, the act shall accept if(cond, a, b), or either branch, as that value."},{"id":"c4","text":"When a declared act uses setsOther, replaces or if in its sets, the product shall preview the act, show its diff and allow it to be undone."},{"id":"c5","text":"When assign-ownership runs on the org seed, the single declared act in org-graview shall produce the same result as the TypeScript mutation."},{"id":"c6","text":"When propose-owner runs on the org seed, the single declared act in org-graview shall produce the same result as the TypeScript mutation."}]
tags:
  - "graview-cloud"
  - "FR-115"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
priority: "medium"
---

assign-ownership and propose-owner each had to be split into a link act and a status act that a person runs both of.
