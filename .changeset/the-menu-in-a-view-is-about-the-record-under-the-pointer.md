---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/tools": patch
---

A right-click or a long press inside a worker view opens the menu about the record under the pointer, and the menu's first frames give the keyboard back, ask the Fast slot at the press and tell each showing once. A worker view draws in a shadow root, so a face saw only the view's region under a press: the menu, its Suggested rows, its AI section and the hover chip were about the whole view wherever the pointer was.

- The record under a press inside a worker view is found from the boxes the view's host measured and judged of it (`@graview/core/record-boxes`: each a record the view was handed that this seat may see), with `recordBoxAt` and, on `@graview/react/drawing`, `recordInView` and `outOfViews`. A right-click, a long press, Shift+F10 on a card, a resting pointer and the hover chip are about that record on the pages face and the scene, and the menu is headed with its name; a press on the view's own ground stays about the place. A card the view marks for a record its host did not judge it drew is not taken on the view's word.
- Escape pressed as a menu opens on a pick inside a card (a task on a day's clock) gives the keyboard back to the pick, never `<body>`.
- The Suggested rows are worked out at the right button's press, or a finger held on its way to a long press, and the Fast slot is asked for their order then (`prepareSuggested`, `askSuggested`); the menu takes that call up as it draws rather than asking again. `useMenuPrepare` returns the sections it got ready.
- Words typed in the menu, which stand the AI section down, no longer make its picks a second showing told to the host (`HostAi.onPickOutcome`): a section hidden while its menu stays open is told once, as the menu goes.
- A Fast-only quick ask offers Find, and says Find can look (`FIND_CAN_LOOK`), only on a page with a Find box.
- The first look's "N of M" counts the hints it shows: the menu's hint is not counted where no record is drawn.

Held by unit tests of the pages (`a-right-click-inside-a-worker-view-is-about-the-record-under-the-pointer`, `the-suggested-rows-are-asked-at-the-press-and-each-showing-is-told-once`), the primitives (`escape-in-the-menus-first-frame-gives-the-keyboard-back`, `the-quick-ask-answers-beside-what-is-selected`) and the embed (`a-first-look-points-at-the-apps-own-controls-once`), by the `guest` harness's taps transport (a right-click on a threat card in a worker view, and a long press on one on a phone, open the menu about that threat) and by the `inline-ai` harness (`escapeInTheMenusFirstFrameGivesTheKeyboardBack`, with no wait before Escape).

Compatibility: Host APIs — additive: `recordBoxAt` on `@graview/core/record-boxes`, `recordInView`, `outOfViews` and `RecordInView` on `@graview/react` and `@graview/react/drawing`, and `FIND_CAN_LOOK` on `@graview/tools` and `@graview/tools/inline-ai`; `useMenuPrepare`'s function now returns the sections it got ready, where it returned nothing. Behavior a host may notice — a menu opened inside a worker view is about the card under the pointer, its `MenuTarget.on` that record's id and its heading the record's name, where it was about the view's place; the Suggested rows' Fast call starts at the press; a Fast-only answer on a page with no Find box says nothing of Find. The wire, stored formats, ops and primitives, derived tool names and input schemas, and the declaration and check finding codes — unchanged. What Graview Cloud does: nothing; a custom view whose cards are bound with `data-record` gets the menu about each card.
