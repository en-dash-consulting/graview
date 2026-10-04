---
"@graview/ship": patch
---

`@graview/ship/runtime` exports `RemoteStatus`, `RemoteCounters` and `RemoteBackoff`, as the main and browser entries do. A Worker or Durable Object that opens a remote store and reports its status, its counters or its backoff had to import those types from an entry it may not import. A test now reads the three entries' export lists and holds the runtime entry to every name the other two export, but those a server has no use for, each listed with why: the browser adapter and tab-to-tab presence (a page's), the photograph budget (a browser's quota), and the file adapter, `serveStore` and the CLI (Node's). The list is checked too, so a name cannot be left out by accident or listed after it arrived.

Compatibility: the wire — unchanged; three types are added to the runtime entry, and no value, route, field or message moves. Ops, stored formats, derived tool names and schemas, and check codes are unchanged.
