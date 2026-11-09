---
"@graview/tools": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/skills": patch
---

A host can refuse a workflow's step into another app in its own words. `FarApps.otherApp(address, origin)` may answer `{ refused: "The owner of this workflow's app may not change Graview Public." }`, and the step is skipped with that sentence, before anything there is read or run; an answer of nothing is still refused in the framework's words, and an act the app's shape lacks is still said to be missing. The sentence is said on one line, cut at a word with an ellipsis past 500 characters, and given a full stop only where it ends in none of its own; an answer that is neither an app nor a refusal is refused in the framework's words. `farAppsOver` takes a `refuses(origin)` grant that says the sentence for apps held in memory, a blank one letting the run in. Code that calls `otherApp` itself now gets the new `FarReached` type, `FarApp | { refused }`, and must check for `refused` before using the app. The `FarApp` types and the `graview-workflows` skill say how.

"Other ways to show this" on a kind's list at an address that narrows it (`?filter=status:doing`, where the list opens as a board) no longer offers an option that flows, such as cards or rows: kept, it would have drawn the list there rather than itself. Every option is drawn over the records the address narrows the page to, so the preview and the page once kept agree. A place is offered its options as before, narrowed the same way, and an address whose filter keeps none of the records is not offered "Other ways to show this" at all. The embed's every-face budget is raised by 956 / 367 bytes for this changeset; the pages face alone stays within its own.

What Graview Cloud does: to word a refusal for an app a workflow may not reach, answer `{ refused }` from `otherApp` rather than an app whose shape leaves the act out.

Compatibility: the JavaScript API — breaking for code that calls `FarApps.otherApp` itself: it gets `FarReached` and checks `refused` before using the app; `farAppsOver` takes an optional `refuses`. The look — "Other ways to show this" at a narrowed address offers only what that address would draw. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
