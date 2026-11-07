---
id: "0211de88-09fd-4901-b003-b940e64aad15"
type: "capability"
title: "openRemote's runtime entry exports the observable-client types, and read-only MCP calls can show presence"
slug: "openremote-s-runtime-entry-exports-the"
statement: "The @graview/ship runtime entry exports the observable-client types RemoteStatus, RemoteCounters and RemoteBackoff, and createMcpHttpHandler can announce an agent's presence on a read-only call."
criteria: [{"id":"c1","text":"The @graview/ship/runtime entry shall export the RemoteStatus, RemoteCounters and RemoteBackoff types, as the main and browser entries do."},{"id":"c2","text":"When a read-only call reaches createMcpHttpHandler, the handler shall be able to announce the calling agent's presence through an onCall hook."}]
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
priority: "low"
---

Small gaps noted while landing FR-49 and FR-47.
