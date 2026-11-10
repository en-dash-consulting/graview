---
"@graview/react": patch
"@graview/primitives": patch
"@graview/embed": patch
"@graview/skills": patch
---

The app's history opens from the inbox and from the host's own menu (Graview HQ f-host-opens-history). People could not find an app's previous versions: the timeline was reached only from a row of Activity, by "As it was". The inbox now ends in one plain row, History ("Every change, and the app as it was"), under every tab, which opens that same timeline at now — a tick per change, the player, "Restore to here", "Back to now" — on the scene and the routed face alike, puts the inbox away and gives the keyboard to the timeline's scrubber. It is drawn only where the face keeps a playback.

A host opens the same timeline from its own menu with `showHistory()` on the handle `mount` returns, from `@graview/embed` and from `@graview/embed/pages`: on whichever face is drawn, and, called before the face has drawn, as it arrives. Underneath it is `showHistory(store)` from `@graview/react/provider`, heard by every face's own playback over that store. No address opens it: the timeline is a layer over whichever page is shown, not a page, and a path of its own would take a name a kind may have. The graview-host-page skill names the method.

Tests: `the-history-opens-from-the-inbox-and-from-the-hosts-menu` (embed) presses History in the inbox and finds the timeline at now with the keyboard on its scrubber, and opens it with `showHistory()` on the routed face, on the scene before it has drawn, and on the pages alone. verify-playback holds `historyInTheInboxOpensTheTimelineAtNowOnBothFaces`: the bell pressed with Enter, Tab walked to the row named "History", Enter, on both faces.

A hosted page's first load grows by 0.4 KB up front (0.4 KB handed a compiled app). Every face grows by 1.9 KB, the pages face alone by 0.3 KB and the embed with the studio handed in by 0.1 KB gzipped, under a raise of their budgets.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged. The JavaScript API gains `showHistory()` on `EmbedHandle` and `PagesEmbedHandle`, and `showHistory(store)` on `@graview/react` and `@graview/react/provider`; nothing is taken away.

What Graview Cloud does: a History row in its own menu, if it wants one, calls `handle.showHistory()`.
