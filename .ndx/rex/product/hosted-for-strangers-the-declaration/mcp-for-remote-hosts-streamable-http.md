---
id: "f674e961-08ad-4ad5-834e-ca32f915478a"
type: "capability"
title: "MCP for remote hosts: Streamable HTTP, honest tool hints, and other people's words marked as data"
slug: "mcp-for-remote-hosts-streamable-http"
statement: "The product serves its MCP tools to remote hosts over stateless Streamable HTTP, with every tool carrying honest hints derived from the declaration and text authored by other people marked as untrusted data."
criteria: [{"id":"c1","text":"When the MCP TypeScript SDK client sends initialize, tools/list and tools/call to createMcpHttpHandler, the handler shall complete each request."},{"id":"c2","text":"The tool derivation shall give every derived tool a title and all four hints (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)."},{"id":"c3","text":"The tool derivation shall mark every remove-<kind> tool as destructive."},{"id":"c4","text":"When a node was written by a principal other than the caller, get_node and search_graph shall return its text marked as { untrusted: true, authoredBy, text }."},{"id":"c5","text":"If the auth hook returns no principal, createMcpHttpHandler shall refuse every call."}]
tags:
  - "graview-cloud"
  - "FR-10"
  - "security"
source: "Graview Cloud FR-10, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: serveMcpStdio, hand-rolled JSON-RPC on protocol 2025-06-18, tools capability only; tools carry no annotations; get_graph and get_node read store.graph directly. MISSING: ChatGPT and Claude reach servers over HTTP, their directories require readOnlyHint/destructiveHint on every tool, and node text written by one collaborator reaches another collaborator's agent as if it were instructions. POSITION: createMcpHttpHandler (Streamable HTTP, stateless per the 2026-07-28 spec, compatible with 2025-11-25 clients) with an auth hook that supplies the principal; tool annotations derived from the declaration (title; readOnlyHint for reads; destructiveHint for acts that remove or sever; idempotentHint where derivable; openWorldHint false); read results wrap text authored by someone other than the caller as { untrusted: true, authoredBy, text }; reads go through seenBy (with d6f8b50f).
