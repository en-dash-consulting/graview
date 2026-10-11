---
"@graview/core": patch
---

`mcpClient` reads the reply to its own request. It read the last `data:` line of an event stream as the answer, so a server that sent a notification after the reply (a log message, progress) or a request of its own handed a sync that notification instead, and a reply whose JSON was split across `data:` lines was not read at all. Now the stream is read as the SSE spec reads it — an event ends at a blank line, its `data:` lines join with a newline, one space after the colon is dropped, a line starting `:` is a comment, and `\r\n`, `\r` and `\n` each end a line — and the answer is the message whose JSON-RPC `id` is the request's, with a `result` or an `error`; notifications, the server's own requests and replies to other ids are passed over, and a JSON body that is a batch is read the same way. An answer with no reply to the request is said as such ("The MCP server sent no reply to get_item."), where it was read as an empty result.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged; the hosted page's first load is the same to the byte. Changed: `mcpClient` throws for an answer that carries no reply to its request.
