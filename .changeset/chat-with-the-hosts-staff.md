---
"@graview/core": patch
"@graview/pages": patch
"@graview/embed": patch
---

A person can chat with the host's staff from inside any app. `PagesApp`'s context and `mount` take `support: { title, transport }`, and the person's menu then says "Chat with <title>" beside the host's own rows and opens a panel that says replies come later and arrive there. The transport is `{ send(message, context), subscribe(onReply), history?() }`; the thread is the person's and the staff's, carried by the host and never in the app's graph, and a reply that arrives while the panel is shut waits on the bell. Each message carries where the person was — the app, the place and the record, who they are and their roles, the last few things they could not do and the framework's version — and the panel says so under the field. `memorySupport()` on `@graview/core/rooms` keeps a thread in the page for tests and development, and `pnpm dev` in the example offers it. Without `support`, nothing shows. Held by `pnpm verify rooms`, at a desk, on a phone and from the keyboard.

Compatibility: additive. `support` on `PagesApp`'s context and on `mount`; `SupportDeclaration`, `SupportTransport`, `SupportContext`, `openSupport`, `whenSupportOpened`, `supportRowLabel` and `keepRecentFriction` on `@graview/core`, and `memorySupport` and `supportContextOf` on `@graview/core/rooms`. Stored formats, ops, the wire, the declaration and check finding codes are unchanged. What Graview Cloud does: pass `support` with its staff transport where it hosts an app as the page or mounts one, keeping each thread and its context in its staff inbox, delivering staff replies through `subscribe` and the thread through `history`, and saying in its own words, or by its plan, when the help is to build an app rather than to use one.
