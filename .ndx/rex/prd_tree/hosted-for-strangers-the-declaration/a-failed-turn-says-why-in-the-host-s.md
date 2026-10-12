---
id: "59a2b7d9-d834-4856-9851-582ced60dcc0"
level: "feature"
title: "A failed turn says why in the host's own words (FR-166)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-166"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.23)"
startedAt: "2026-10-12T05:00:00.000Z"
completedAt: "2026-10-12T05:30:00.000Z"
endedAt: "2026-10-12T05:30:00.000Z"
acceptanceCriteria:
  - "A plain Error a host's turn or complete throws is carried in the seat's aside"
  - "A TypeError or any other kind keeps the old aside"
  - "The sentence is one line, at most 160 characters, and cannot end the aside early"
description: "answerLocally swallowed the error around the model and wrote one aside for a refused key, a rate limit and a step the host would not read; Cloud's turn throws the host's sentence and none of it reached Nick on phone or desk."
lastModified: "2026-10-12T05:30:00.000Z"
resolution: "Shipped in the PR carrying the host's sentence in the aside (hostSentence in packages/tools/src/local.ts)."
---
