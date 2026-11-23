---
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
---

The Fast slot shows only what it is sure of, answers sooner, says plainly what it cannot answer, and tells the host how each pick ended. With the Thinking slot off, the Fast slot (Jev, `HostAi.fast`) is the only AI most people meet, and its menu showed its top three however unsure it was, asked it even where every suggestion already fitted the rows, and answered a question it could not answer in words with "These fit …" or "The AI had no answer to that here."

- A pick or a fill the Fast slot is less sure of than a floor is not shown: the menu's Suggested rows, the AI section's suggestions, a record's fills, the selection bar's act and the quick ask's picks. The floor is `PICK_FLOOR` (0.2) unless the host says `HostAi.pickFloor`.
- Where three candidates or fewer are offered, all of them fit the menu's rows, so the Fast slot is not asked: they are shown as they are, at once (`suggestHere` and the Suggested rows).
- The menu is told it is opening as the right-click is pressed, or as a finger is held on its way to a long press, before it draws: a section's `prepare` is handed why (`MenuReadying`: `"rest"`, `"keyboard"`, `"touch"`, `"open"`), and what worked here before is read then, so the Suggested rows are whole in the menu's first frame and the Fast slot is asked once as it opens. The Suggested rows keep the room they had while the menu is open, and the AI section holds its rows' room while it is fetched.
- A resting pointer asks ahead for the AI section's suggestions where the host lets it (`HostAi.prefetchOnRest: true`; off unless said, since it is a call the reader did not ask for), once per record until it changes.
- A quick ask the Fast slot alone cannot answer says what it can do instead (`FAST_ONLY_SAID`, `FAST_ONLY_PICKED`) and offers Find for the same words (`InlineResult.findInstead`), and a chat the host connects (`HostAi.chat`, its label and how to open it).
- The first look points at the menu on a record — a right-click, a long press on a touch screen, and the hover chip where the host offers it — beside the first record drawn, where the host gave the app AI (the `menu` anchor). An embed hands its `ai` to the first look, which is drawn outside its provider.
- Each pick a menu or the hover chip showed is told to the host as taken or left (`HostAi.onPickOutcome`, `PickOutcome`): where it was shown, what it said, how sure the model was and which model ranked it.

Held by unit tests of the tools (`the-fast-slot-shows-only-what-it-is-sure-of-and-says-what-it-cannot-answer`), the primitives (`the-menus-suggested-rows-show-only-what-the-fast-slot-is-sure-of`, `the-quick-ask-answers-beside-what-is-selected`), the pages (`the-menu-asks-as-the-right-click-starts-and-tells-the-host-how-each-pick-ended`) and the embed (`a-first-look-points-at-the-apps-own-controls-once`), and by the `menu` harness (`theMenuAsksJevNothingForWhatFitsItsRows`, `aRestingPointerAsksAheadWhereTheHostLetsIt`, `theFirstLookPointsAtTheMenuOnARecord`).

Compatibility: Host APIs — additive: `HostAi.pickFloor`, `prefetchOnRest`, `chat` and `onPickOutcome` are optional, and a host that sets none of them gets the floor, the skipped call and the honest wording with nothing else asked of it; `MenuSection.prepare` may take the new `why` argument, and one that takes none is called as before; `FIRST_LOOK_ANCHORS` gains `menu`. Behavior a host may notice — a menu with three suggestions or fewer no longer calls the Fast slot, a pick under the floor is no longer shown, and a Fast-only quick ask answers in the new words with Find beside them rather than failing. The wire, stored formats, ops and primitives, derived tool names and input schemas, and the declaration and check finding codes — unchanged. What Graview Cloud does: pass `onPickOutcome` to measure the quick AI's picks, `chat` to offer its own connected chat where Jev cannot answer, `prefetchOnRest: true` to have a resting pointer ask ahead, and `pickFloor` to hold Jev to more or less; nothing is needed to take the rest.
