---
id: "286f8662-3524-451a-a855-b4afed3ef0e4"
level: "task"
title: "graview mcp and graview apply host the agent tool surface against a file, SQLite or remote store"
status: "pending"
priority: "critical"
acceptanceCriteria:
  - "graview mcp <entry> --data <dir> answers initialize, tools/list and tools/call over stdio; a mutating call lands in the file adapter's log.jsonl and snapshot.json and is undoable from a later session"
  - "graview apply <entry> --call add-task --args '{...}' --as agent-x --roles owner applies through store.apply under that principal; a seat the policy refuses gets the policy's own sentence and exit code 1"
  - "graview apply --plan <file> applies every call as one batch (one undo), honouring { $plan: name } references; --preview prints the diff and violations and writes nothing"
  - "--sqlite <file> and --remote-url <url> are the same commands against those backends; against a remote the refusal reaches the CLI before it exits"
  - "graview mcp <entry> --list prints the seat's tools as MCP tools/list JSON; every mutation tool there is one the seat may run"
  - "A test drives the stdio protocol end to end against a temp directory; no MCP SDK dependency is added"
description: "A coding agent with only a shell or MCP attaches to a persisted store with no custom glue. graview mcp <entry> speaks MCP over stdio around createToolRuntime + createMcpAdapter; graview apply <entry> --call <name> --args '{...}' applies one act and --plan <file> applies many as one batch (planFrom/applyPlan, $plan references honoured); --preview dry-runs. Both take the same store backends as serve — --data <dir> (file), --sqlite <file>, --remote-url <url> against a running graview serve — and the same seat flags (--as, --roles). Everything goes through store.apply under the seat's principal, so the policy refuses on the host exactly what it refuses in the browser. --list prints the seat's tools as MCP tools/list JSON, the catalog artifact a host registers without hand-writing schemas."
lastModified: "2026-09-28T19:46:12.332Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
