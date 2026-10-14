---
"@graview/primitives": patch
---

The arrows choose rows. Choosing three records by keyboard cost 59 to 125 presses, Tab stopping at every row's box and every row's name in turn. A list's boxes — on the pages' lists, a kind's stop and a board — are now one Tab stop, at the box the keyboard was last on: the arrows move between the rows' boxes, Home and End to the first and the last, Space chooses the row it is on, and Shift with an arrow chooses every row from where the choosing began to the one it moves to, so three records are Tab to the list, Space, ↓, Space, ↓, Space. A row's box shows while the keyboard is anywhere in the row. Tab through a list now passes each row once.

Compatibility: no surface changes. A choose box's `tabIndex` is now -1 but for one per list; a host that drove the boxes by Tab focuses one and uses the arrows. The selection bar is unchanged (fetched with the first record chosen, nothing in it found to cut).
