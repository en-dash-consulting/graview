---
"@graview/primitives": patch
---

"Back to now" leaves the keyboard where the timeline was opened, and the timeline's scrubber is a target a finger can hit. The timeline closes when "Back to now" is pressed, and the button goes with it, so the keyboard was left on `<body>` and a person who pressed it had to find their place again from the top of the page. It now goes back to what had the keyboard as the timeline opened, a host's own button that called `showHistory()` among them, or, where that is gone (the app menu's History row, closed with its menu, or a row of Activity), to the app menu's button within that embed, never another app's on the page. "Restore to here" does the same. A person who went on elsewhere keeps their place. The scrubber, a browser's range input under 24 pixels tall beside the ticks and the play button, is 24 pixels tall. Both were open problems the watch kept on `verify-playback` (`keyboard-lands-nowhere`, `target-too-small` at 1440 wide). Held by a unit test of the embed (`back-to-now-leaves-the-keyboard-where-the-timeline-was-opened`), on both faces, and by `pnpm verify playback`.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The JavaScript API is unchanged. What Graview Cloud does: nothing.
