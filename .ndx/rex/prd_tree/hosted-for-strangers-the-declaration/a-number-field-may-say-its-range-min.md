---
id: "a60b249d-ad48-4433-a5ea-72914e06c701"
level: "feature"
title: "A number field may say its range: min, max and step (FR-114)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-114"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
startedAt: "2026-10-06T22:10:36.000Z"
completedAt: "2026-10-06T22:10:36.000Z"
endedAt: "2026-10-06T22:10:36.000Z"
acceptanceCriteria:
  - "A number or integer field takes min and max (and step), checked against default, honoured by every form and input, enforced as validation at apply; set-options or a new edit changes them"
  - "level: { type: integer, min: 1, max: 5 }: the form won't take 9, an act given 9 is refused as invalid, check flags a default outside the range"
description: "A level limited to 1-5 by a rule took 9 and 7 at the form; the document format had no min/max."
lastModified: "2026-10-06T22:10:36.000Z"
---
