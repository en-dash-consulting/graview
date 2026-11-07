---
"@graview/core": patch
"@graview/primitives": patch
"@graview/react": patch
"@graview/skills": patch
---

The inbox opens on what needs you (Roadmap f-inbox-needs-you-first). "Kinda confusing and hard to find what I need": the bell's badge read 4, "Inbox — 2 waiting for you, 4 changes", and the 4 was Activity, which asks nothing of anyone; it could open on Activity with suggestions waiting; For you was one undivided list; a broken rule was a separate orange dot by the avatar saying `quote = —`; and a person who kept saying No to a suggestion had no way to stop that kind of thing.

The bell counts only what needs this person: suggestions to decide, proposals to review, the rules broken that they could fix, and unread host notices marked as needing them. Its name says so, "Inbox — 3 need you: 1 rule broken". Activity's count is on its own tab. It opens on For you whenever something there needs them, wherever it was left, and holds the tab once it has opened.

For you is two parts, each with a one-line empty state: **Needs you** (suggestions grouped by record, proposals, broken rules, host notices marked as needing you) and **Updates** (the rest: other notices, what was done while you were away, a rule this seat cannot fix, and what you said not to suggest).

A broken rule stands under Needs you in words, "Crumbs Bakery is booked but has no quote", with its fix by its own label. A fix that needs nothing more is made at a press; one that asks for something, and the sentence itself, open the acts on the record. The `Standing` dot says only that all is well, and is not drawn while a rule is broken. A scene's skip link and a first look's `problems` anchor go to the bell.

Activity says what it means: "undo +1" reads "Undo 2 changes", the history icon reads "As it was", and a template's example batch reads "Example records from the template" with "Remove examples".

"Don't suggest this kind of thing" stands beside No, for whoever may decide a suggestion of the app's own. `stopSuggesting(store, id)` on `@graview/core/tidying` declines the suggestion and its kind (`suggestionKind`: a link by its relation, anything else by its act, whatever it is about): whatever else waits of that kind leaves every tray, the app's own actor is refused it from now on (`declined(store, calls)` says so), a checkpoint keeps it, and it is a row of Activity with its Undo. `stoppedSuggestions(store)` lists what stands, which Updates offers with "Suggest again". A person's proposal of that kind still waits.

The unit tests `a-person-stops-a-kind-of-suggestion` and `the-inbox-opens-on-what-needs-you` hold each claim; the `chrome` harness holds them in a browser on both faces as `theBellCountsWhatNeedsYouAndNotWhatHasHappened`, `theInboxOpensOnForYouWhereverItWasLeft`, `forYouIsNeedsYouAndUpdates`, `aBrokenRuleIsSaidInWordsWithItsFixAndNoDotOfItsOwn` and `aKindOfSuggestionIsStoppedRememberedAndTakenBack`.

Compatibility: the look — the bell's count and name change as above, an unread host notice not marked `needs` is no longer counted on it, and `[data-testid="standing"]` and its `problems` popover are gone while a rule is broken (the rows are `[data-testid="problems"]` under Needs you); `Standing` no longer takes a press. The JavaScript API — new, optional: `HostNotification.needs`; new on `@graview/core/tidying`: `stopSuggesting`, `stoppedSuggestions`, `suggestionKind`; `inboxWords` on `@graview/primitives` now takes the count and the rules' words; the `problems` popover name is gone from `POPOVERS`. Ops and primitives — unchanged in shape: an undo that declines a suggestion may carry `lineage.stopsKind: true`, which an older build keeps as an unknown lineage key and reads as an ordinary decline. Stored formats — `Epoch.declines` may hold a kind's key beside the others, which an older build ignores. The wire — unchanged: a stop is an undo with its intent and lineage. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: hand `notifications` with `needs: true` on proposals to review and failed workflows, as its main already does; nothing else is asked of it. A template's examples read as such only under a batch id beginning `examples:`, as `graview apply --template --examples` names them.
