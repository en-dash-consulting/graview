---
"@graview/primitives": patch
---

A calendar's entry wraps its name rather than cutting it: a month on a phone, or in a place's picture on the home, gives a day a few letters, and "Sugar & Spoon" read "Sug…" — a different vendor, or none. An entry now breaks between words, and inside a word only where the word is wider than the day, so every name is there whole. Found by the `quiet` harness's `noTextIsCutOffOnTheFourScreens`, which had failed on the vendors' phone home in every engine.

Compatibility: ops and primitives — unchanged in shape; the look changes: a calendar entry whose name is wider than its day is as tall as its lines rather than one line with an ellipsis. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: nothing; a calendar drawn after it updates shows each name whole.
