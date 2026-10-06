---
id: "5e600ef7-20bf-4fb3-8223-ba49545c37aa"
level: "feature"
title: "Presence a host can add to: kind, name, onBehalfOf, announce for socketless visitors, and welcome.participant (FR-47)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-47"
source: "Graview Cloud FR-47, 2026-10-03 (brief after 0.1.2)"
startedAt: "2026-10-03T19:14:31.476Z"
completedAt: "2026-10-03T19:14:31.476Z"
endedAt: "2026-10-03T19:14:31.476Z"
acceptanceCriteria:
  - "Presence carries kind, a display name and onBehalfOf"
  - "handler.announce(presence, ttlMs) shows a visitor without a socket; welcome.participant tells a client its own key"
  - "An RPC call by an agent shows in every socket's presence for the TTL, as the agent and for whom, filtered by sights (presenceSeenBy)"
description: "\"Claude, for Ada\" appearing while it works comes over MCP/RPC, not a socket."
lastModified: "2026-10-03T19:14:31.563Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
