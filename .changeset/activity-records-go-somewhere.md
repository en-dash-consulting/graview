---
"@graview/core": patch
"@graview/primitives": patch
---

A record named in Activity goes to that record when pressed, and nothing else there looks pressable. The records under each change and each call were chips carrying a pick target that only the scene's own pointer answered, so on Pages, and from the keyboard on either face, they looked pressable and did nothing. A record still in the graph is now a button that goes to its page on Pages, or focuses and chooses it in the scene, and closes Activity as it goes. A record the change removed is named from the removal, where it used to show its id ("i2"), and is a plain label, as is an argument that is a word rather than a record. A design that replaces the routed face's shell under the bar (todo's) no longer shows two "Activity" buttons once there is a change: the derived bar drew Activity in its tools and also handed its own slot to the design's face controls, which drew it there too. It is now drawn once, in the slot.

The every-face and studio budgets are raised by 1_169 / 470 bytes in their files.

A change's preview no longer says a text field turned to Markdown "is now said as in undefined — 12 reads 12". `diffDocuments` said the number-format sentence for any change of format, and `formatWords` took `markdown` for a number's unit; the preview now says only that the field is written in Markdown, and adding a Markdown text field says "(text, written in Markdown)".

Compatibility: no surface changes. Activity's records carry `data-testid="activity-record"` and `data-record`, not `data-graview-pick`.
