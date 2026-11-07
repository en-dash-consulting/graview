---
id: "59a2b7d9-d834-4856-9851-582ced60dcc0"
type: "capability"
title: "A failed turn says why in the host's own words (FR-166)"
slug: "a-failed-turn-says-why-in-the-host-s"
statement: "When a host's model turn or completion fails with a plain Error, the seat's aside says why in the host's own sentence."
criteria: [{"id":"c1","text":"When a host's turn or complete throws a plain Error, the seat's aside shall carry that error's sentence."},{"id":"c2","text":"When a host's turn or complete throws a TypeError or any other kind of error, the seat shall show the default aside."},{"id":"c3","text":"The seat shall carry the host's sentence as a single line of at most 160 characters that cannot end the aside early."}]
tags:
  - "graview-cloud"
  - "FR-166"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.23)"
priority: "high"
resolution: "Shipped in the PR carrying the host's sentence in the aside (hostSentence in packages/tools/src/local.ts)."
---

answerLocally swallowed the error around the model and wrote one aside for a refused key, a rate limit and a step the host would not read; Cloud's turn throws the host's sentence and none of it reached Nick on phone or desk.
