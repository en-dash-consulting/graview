---
id: "40fc2a34-bd4a-45e5-98f0-dbec85edb1fe"
level: "feature"
title: "mcpClient reads the reply that matches its request from an event stream"
status: "pending"
priority: "medium"
tags:
  - "n-dx"
  - "sync"
  - "mcp"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "The reply is chosen by JSON-RPC id"
  - "Notifications before or after it are ignored"
  - "A test with an interleaved stream holds it"
description: "mcpClient reads the last data: line of an event stream rather than the reply whose id matches its request."
lastModified: "2026-10-11T08:00:00.000Z"
---
