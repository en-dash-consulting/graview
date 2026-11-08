---
id: "b493c452-7a87-4405-8704-e3b29e0bd291"
type: "capability"
title: "A snapshot says when it was made and what it holds, and can load by kind"
slug: "a-snapshot-says-when-it-was-made-and"
statement: "A snapshot states when it was generated and how many records of each kind it holds, and its body is partitioned so the adapter can load it lazily by kind, while snapshots written before this format still load."
criteria: [{"id":"c1","text":"A snapshot shall carry a header stating its generatedAt time and a count for each kind it holds."},{"id":"c2","text":"A snapshot shall have a line-delimited or kind-partitioned body that the adapter can load lazily."},{"id":"c3","text":"When a snapshot written before the header and partitioned body existed is loaded, the adapter shall load it."}]
tags:
  - "n-dx"
  - "ship"
  - "snapshot"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #198: @graview/core/snapshot writes a header line (generatedAt, records and links per kind, where each kind's lines are) and a record per line; readSnapshot and fetchSnapshot take only the kinds asked for, an old { nodes, edges } file reads as format 1, and every --seed reads either."
---

n-dx's 3.3 MB snapshot loads whole into a memory adapter on every page load; nothing says how stale it is or what kinds it holds.
