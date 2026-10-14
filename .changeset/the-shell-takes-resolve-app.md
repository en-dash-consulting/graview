---
"@graview/primitives": patch
---

The Shell takes `resolveApp` itself (FR-171). The host's way to name another app was the provider's alone, so a host drawing the whole-page `Shell` had to reach around it and hand `resolveApp` to the `GraviewProvider` above it to have an app-link drawn as the app rather than its address. `<Shell resolveApp={…}>` takes the same `resolveApp(address, viewer)`, answering `{ name, icon?, headline?, href }`, `{ denied: true }` or `null`, as it takes `files`; an app-link under the Shell asks it first and the provider's after. `mount` and `<Embed>` already take one. The context it travels in is fetched with the Shell and the first app-link drawn, never on a page that draws neither.

Compatibility: additive. `ShellProps` gains an optional `resolveApp`; a Shell without one draws an app-link as before, by the provider's resolver or as its address. What a host does: hand `resolveApp` to the `Shell` it draws, or keep handing it to the provider; the Shell's is asked first.
