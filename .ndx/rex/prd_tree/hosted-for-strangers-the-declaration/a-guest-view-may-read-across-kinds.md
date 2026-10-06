---
id: "b3be1519-795e-463d-aaeb-ca27df2a353e"
level: "feature"
title: "A guest view may read across kinds, gets labels, and may attach to the home (FR-85)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-85"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
acceptanceCriteria:
  - "A guest registration declares reads: { kinds?, edges? }; the host adds those records and edges as the viewer sees them; GuestNode.label is filled as the host labels a record; a view may attach to the home"
  - "A frame guest over package that reads offer and includes gets each package's offers; an unseen offer is absent from nodes and edges; a home-attached guest renders as the home body"
description: "A many guest sees only its kind's members and their edges; GuestNode.label is declared but never filled. For owner-uploaded frames; the worker form is FR-91."
lastModified: "2026-10-06T03:56:09.000Z"
---
