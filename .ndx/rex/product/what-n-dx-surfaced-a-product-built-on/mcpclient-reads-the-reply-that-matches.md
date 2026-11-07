---
id: "40fc2a34-bd4a-45e5-98f0-dbec85edb1fe"
type: "capability"
title: "mcpClient reads the reply that matches its request from an event stream"
slug: "mcpclient-reads-the-reply-that-matches"
statement: "mcpClient reads the reply whose JSON-RPC id matches its request from an event stream, ignoring other messages on the stream."
criteria: [{"id":"c1","text":"When mcpClient reads an event stream, mcpClient shall choose the reply by the JSON-RPC id of its request."},{"id":"c2","text":"When an event stream carries notifications before or after the matching reply, mcpClient shall ignore those notifications."}]
tags:
  - "n-dx"
  - "sync"
  - "mcp"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "medium"
resolution: "Fixed in #211: mcpClient reads the stream as the SSE spec does and takes the message whose JSON-RPC id is its request's, and says when no reply is there."
---

mcpClient reads the last data: line of an event stream rather than the reply whose id matches its request.
