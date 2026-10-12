---
"@graview/core": patch
"@graview/tools": patch
---

A kind's JSON Schema and an act's tool schema are `@graview/core/json-schema`'s. `mutationToolSchema`, `toJsonSchema`, `nodeJsonSchema`, `schemaJson` and their types were exported from `@graview/core`, and a bundler places a whole module in every chunk that can reach it: only a seat's tools and the CLI derive a tool schema, yet every hosted page carried the module in its first load. They are gone from `@graview/core`; import them from `@graview/core/json-schema`. The hosted page's first load is 1,278 bytes smaller, which pays for the measured screen height (FR-165).

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. The four functions and two types leave `@graview/core` for `@graview/core/json-schema`.
