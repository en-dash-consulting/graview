---
id: "d699930d-5fb5-49c1-82a6-a07dd9ed3007"
level: "feature"
title: "A rule's refusal says so: reason refused, not invalid (FR-119)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-119"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
startedAt: "2026-10-07T14:18:37.000Z"
completedAt: "2026-10-07T14:41:20.000Z"
endedAt: "2026-10-07T14:41:20.000Z"
acceptanceCriteria:
  - "An allowedWhen refusal, and any refusal a declared act's own logic makes, carries reason \"refused\" (or a new \"guard\"); \"invalid\" stays for arguments and nothing-to-change; refusalOf reads it"
  - "resolve-question on a resolved question refuses with reason \"refused\"; edit-person { id } refuses with \"invalid\""
description: "ActRefusal's reason defaults to invalid, so a host can't tell 'the rules say no' from 'you sent the wrong thing'."
lastModified: "2026-10-07T14:41:20.000Z"
resolution: "Shipped in #123 (0.1.15): REFUSAL_REASONS gains refused; a document act's allowedWhen and ActRefusal's default say it; invalid stays for the call as sent; agent tools, the MCP adapter and graview mcp say reason beside error."
---
