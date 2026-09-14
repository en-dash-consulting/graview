---
"@graview/primitives": patch
"@graview/studio": patch
"@graview/react": patch
---

One door for what is yours: the scheme, the installation and the studio move behind the profile — and Back knows about both of them.

The bar carried "Show the installation" and "Studio" beside the places, so every reader met two controls only a keeper can use in the same row as the app's own pictures. It also carried a scheme toggle while the profile pane carried a pair of scheme buttons — two controls for one setting. All three live in the profile now, under a heading that hides itself when it holds nothing, and the profile button wears a gear so the settings can be found rather than discovered.

**Both doors are stops.** Showing a module said in its own comment that it was one — "so Back knows the way out" — and it was not: `shown` was missing from the comparison that decides whether a change pushes a history entry, so the address gained `show=installation` and the entry was REPLACED. The arrows stayed grey and one Back from the installation left the app. Opening the studio was component state, so the one door in this interface the back button knew nothing about was the door into the app's own declaration. It is `in.studio=open` now: the browser's arrows and the bar's own carry you in and out, a link can open it, and closing puts you back on the stop you came from. `adjustment` is exported and tested, and `verify-navigation.mjs` drives both doors in a real browser.

Three things had to be true for the move to work. The pane is **mounted whether or not it is open** and hidden instead — a control in it may own something that outlives it, and unmounting the pane on the first press inside the studio took the studio's portal with it. `hidden` alone was not enough, because the pane's own inline `display: grid` beats the browser's `[hidden] { display: none }`, and a closed pane that still swallows presses is worse than one that is merely visible. And a press inside a dialog the pane opened is not a press "away" from it.

Two things the move exposed, both fixed: the seat switcher did not wrap, so in a 280-wide pane the third seat was a name cut in half; and "Your record ↗" was a nineteen-pixel control, which no audit had ever measured because until now no audited screen opened this pane.
