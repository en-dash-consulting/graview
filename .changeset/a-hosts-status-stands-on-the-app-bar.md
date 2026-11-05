---
"@graview/primitives": patch
"@graview/embed": patch
---

A host's status stands on the app bar beside its tools. Graview Cloud says who can open an app — "Only you", "Workspace", "Anyone with the link", "Public" — and could only put it on the bar as a `barActions` press, so what it meant was said only once pressed. `status: { label, icon?, description, href?, target? }` on `mount`, the pages embed, the frame and the Shell draws one quiet item beside the host's tools: its mark (`"lock"`, `"globe"`, `"people"`, or the host's own emoji, glyph or inline `<svg>`) and its word, its sentence on hover and as its accessible description, reachable from the keyboard, and a link where it has an `href`. On a phone's bar its word folds away behind its mark, as Share's does; with no mark the word stays. `setStatus` on both mounts' handles says it again without a reload, and `undefined` takes it off. The type `BarStatus` is from `@graview/primitives`, `/frame`, `/pages` and `@graview/embed`.

The unit tests `a-hosts-status-says-itself-on-hover-and-folds-to-its-mark-on-a-phone` and `a-hosts-status-is-on-the-app-bar-and-changes-without-a-reload` hold it on the bar of the embed's pages, its scene and the pages alone. A hosted page spends 1.1 KB more up front (1_166 bytes minified, 220 gzipped), every face 1_078 bytes more minified.

Compatibility: the look — new, only where a host gives a status: `app-status` (`.graview-bar-status`) beside the host's tools. The JavaScript API — new, optional: `status` on the mounts, the frame and the Shell, `setStatus` on `EmbedHandle` and `PagesEmbedHandle`, and the type `BarStatus`. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: give `status: { label: "Only you", icon: "lock", description: "Only you can open this app.", href: "/sharing" }` in place of the `barActions` press, and `setStatus` when sharing changes.
