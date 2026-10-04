---
id: "0211de88-09fd-4901-b003-b940e64aad15"
level: "feature"
title: "openRemote's runtime entry exports the observable-client types, and read-only MCP calls can show presence"
status: "pending"
priority: "low"
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
acceptanceCriteria:
  - "@graview/ship/runtime exports RemoteStatus, RemoteCounters and RemoteBackoff as the main and browser entries do"
  - "createMcpHttpHandler can announce an agent's presence on a read-only call (an onCall hook)"
description: "Small gaps noted while landing FR-49 and FR-47."
lastModified: "2026-10-03T19:14:55.000Z"
---
