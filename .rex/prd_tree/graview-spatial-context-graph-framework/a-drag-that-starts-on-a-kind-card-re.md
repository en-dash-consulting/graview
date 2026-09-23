---
id: "84e07c7b-4664-4897-abb5-2920853d047c"
level: "task"
title: "A drag that starts on a kind card re-measures every connector against the DOM on every move"
status: "completed"
priority: "medium"
startedAt: "2026-09-23T13:16:22.609Z"
completedAt: "2026-09-23T13:46:47.571Z"
endedAt: "2026-09-23T13:46:47.571Z"
acceptanceCriteria: []
description: "Found 2026-09-23 when Rota's new location district landed under verify-panning's fixed drag start (900,600): pressing a kind card and dragging does not pan (a press, not a pan — fine), but each pointer move re-renders the connectors, and connectors.tsx withinItsScroller / getBoundingClientRect / querySelectorAll run per move — a 1.3s drag unthrottled, 8s of blocked main thread under the harness's 4x CPU throttle. verify-panning now searches for open ground (groundNear) so the pan is measured; this is the path it stopped measuring. Acceptance: a drag starting on a card holds 55fps under the harness throttle (add it to verify-panning as its own run), and connectors are not re-measured by moves that change nothing they draw."
lastModified: "2026-09-23T13:46:47.637Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
