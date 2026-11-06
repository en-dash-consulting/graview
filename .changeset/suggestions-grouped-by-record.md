---
"@graview/primitives": patch
---

Suggestions about the same record stand under its name in the inbox. Placing a note in a chapter, linking it to another and setting it aside were three cards, each saying "What I steer by" again. Now the note is named once, a link heading a list, and each suggestion under it says only what differs: "Put in 09 · Without a Map?", "Wait for First job?", "Set aside?", each with its own Why?, Yes, No and Later and the same test ids. A record two or more suggestions are about wins over the line that groups several alike, which keeps the rest: "2 notes to put in chapters" still stands for placements about different notes, and one suggestion left alone about its record is said whole again. The heading is a heading at the inbox's next level and labels its list; each Yes and No is described by the record's name and the row's words together, so a screen reader still hears the whole question. Spacing sets the rows in from the name, with no box and no chip.

The sentence is read off the call as before; `suggestionSentence` now also says which record it is about and the sentence without it, and `suggestionGroups` says the record a group stands under. Both are drawn in the inbox's lazy chunk; every face spends 1,345 bytes more minified, 407 gzipped, and nothing up front.

The unit tests `suggestions-about-one-record-stand-under-its-name` and `the-inbox-groups-suggestions-under-the-record-they-share` hold it, and `the-suggested-tray-never-scrolls-sideways` now finds its 120-character name once, in the heading; verify-chrome's new `suggestionsAboutOneRecordStandUnderItsName` opens three suggestions about one task on both faces, reaches the heading's link and the rows under it from the keyboard, and answers one.

Compatibility: the look — several suggestions about one record are an `li` with the new `suggestion-record-group` (`data-record` the record's id), its `suggestion-record-heading` (role heading) holding the record's `suggestion-record` link, then an `ol` labeled by it whose `suggestion` rows say the sentence without the record; `suggestion-group` now holds only several alike about different records. The JavaScript API — unchanged; `@graview/primitives` exports nothing new. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: nothing to change.
