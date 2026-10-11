---
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/tools": patch
"@graview/core": patch
"@graview/skills": patch
---

A host's turn knows the app the seat is mounted with, so `describe_place` describes a lens place. Inside `HostAi.turn` the seat built its read tools from the store alone, and the chat's own runtime did the same, so a model asking `describe_place` for a lens or the declared home was told "is not a place this app has": the app never reached the seat. `GraviewProvider` now takes `app` and holds it on its context (`useGraview().app`), inheriting the app of a provider it is drawn inside; `mount` and `<Embed>` pass theirs on both faces, and `PagesApp`'s `context.app` reaches the provider under the pages. The chat hands it to its own tool runtime, to the workbench's agent seat and, as `ChatContext.app`, to a host's turn, whose `describe_place` now answers exactly as the runtime `graview mcp` serves does, for the seat that asked. With `app` given, a provider's reader `settings` default to `app.settings`. `graview create` writes `app` on the provider and on the pages' context. The hosted page carries 132 bytes fewer up front (589 625; 589 757 before), and as many fewer handed a compiled app (547 324; 547 456): the embed now hands the provider each option as given, which the provider's props accept as `undefined`, rather than spreading each one in only when it is set.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. New: `app` on `GraviewProviderProps`, `GraviewContextValue`, `PageContext` and `ChatContext`. Changed: `GraviewProviderProps`' `principal`, `seats`, `people`, `memory`, `presenceTtlMs`, `presence`, `brand`, `onKeepLens` and `ai` also accept `undefined`, which means the same as leaving them out. What a host does: one that mounts its own `GraviewProvider` passes `app={yourApp}` (and `app` in `PagesApp`'s context) so its seat and its turn can describe the app's lenses and home; `mount` and `<Embed>` need nothing.
