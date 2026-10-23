---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/tools": patch
"@graview/skills": patch
---

The Suggested tray offers Not now beside Accept and Decline. It hides a suggestion from the person who pressed it until tomorrow, and keeps that as a `Dismissal` in the host's store of the person's own state (`dismissals`: `{ list, dismiss, onChange? }`, a `DismissalStore`, on `GraviewProvider`, `mount` and `PagesApp`). Without one, the tray keeps it in this browser: localStorage where the page may use it, else the page's memory. The log says nothing of it, so the suggestion still waits for everyone else and the app's own actor is held to nothing; Decline still answers for everyone. What the button does is said to a screen reader, and when a row settles the keyboard moves to the next row, or to Activity, never to `<body>`. Given what the app's own actor did while the person was away (`whileAway`: `{ tidied, waiting? }`, which `whileAway()` from `@graview/tools/tidy` returns), the tray says "One suggestion waiting · tidied 12 things while you were away", and it still draws when nothing waits but something was done. A seat gets the same answer as a tool: `withNotNow(runtime, dismissals)` from `@graview/tools` lists `dismiss_suggestion` (with `until`, an ISO time, if the person names one) and leaves what the person dismissed out of `list_suggestions`. The chat and the agent seat wrap their runtimes with it. It wraps the runtime instead of living in it, so the names Graview Cloud's worker imports stay at 1_999_652 bytes of their 2 MB. Activity folds everything one run of the app's own actor applied (`Lineage.run`) into one row, wherever a person's change fell between its batches, and says a run made overnight that ended today as "Tidied 12 things overnight". Where an actor gave no run, consecutive batches fold as before. A hosted page carries 0.1 KB more up front for it (105 bytes, 51 gzipped), and the scene face 480 more before it draws.

Compatibility: additive. `dismissals` and `whileAway` are optional props, a host that passes neither gets the tray in this browser, and `dismiss_suggestion` is listed only by a runtime wrapped with `withNotNow`. The digest row a run makes is new: Activity rows for an actor that gives no `run` fold as before, and `ActivityRow`'s digest gains an optional `run`. Ops, stored formats, the wire, the document format and the tool schemas a bare `createToolRuntime` lists are unchanged.
