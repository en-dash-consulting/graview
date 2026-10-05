---
id: "bc9a951f-ff66-4926-83d6-fdc1f6e473f9"
level: "feature"
title: "Version skew on the wire: build strings, a reload answer, carried calls, and a codec name (FR-44)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-44"
source: "Graview Cloud FR-44, 2026-10-03 (brief after 0.1.2)"
startedAt: "2026-10-03T19:14:28.881Z"
completedAt: "2026-10-03T19:14:28.881Z"
endedAt: "2026-10-03T19:14:28.881Z"
acceptanceCriteria:
  - "hello.build and welcome.build carry opaque host strings; a tab on another build keeps working and is told once"
  - "A server answers reload for a protocol it no longer serves; openRemote's carry hook (storage + key) keeps unsent calls across the reload and offers them on the next open"
  - "Two codecs on one path can be told apart (a wire name in hello, or a documented WebSocket subprotocol)"
description: "During a rolling deploy old tabs talk to new rooms; a release must not eat someone's edit."
lastModified: "2026-10-03T19:14:28.971Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
