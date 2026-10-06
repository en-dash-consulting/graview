---
"@graview/guest": patch
"@graview/core": patch
---

A frame guest gets the app's look, and follows the app's toggle (FR-86). No prop or message of a frame guest carried the theme, so an uploaded view could not match the app it sat in. Its props now carry `theme`, the `GuestTheme` a worker view is handed (FR-91): the scheme, the accent, ground, panel, ink, muted ink and edge colours, and the body and mono fonts. They are read off the element the frame is drawn in, and the scheme is the app's own (the embed's `data-graview-scheme`), never the system's preference over it. The host pushes again when the app's toggle changes the look, and not for a change that leaves it as it was. `mountGuestView` takes `theme` for a host that knows better. Reading and watching the look is now one small module both hosts use (`readTheme`, exported from `@graview/guest/host`), so a page that draws only frames carries it and nothing of the open kit. A unit test mounts a frame in an app stamped dark and finds every token in its first push, a push of the light theme when the app's toggle goes light while the system still prefers dark, and no push for a change that changes nothing. `guest-sandbox --transport=client` finds a guest painted from `props.theme` repaint when the app goes dark, in Chromium, WebKit and Firefox.

Compatibility: the wire — a frame guest's `GuestProps` now carry `theme`, which the protocol already declared optional; `GUEST_PROTOCOL` is unchanged. `capabilities().shipped` gains `FR-86`. Ops, stored formats, check codes and tool schemas are unchanged.
