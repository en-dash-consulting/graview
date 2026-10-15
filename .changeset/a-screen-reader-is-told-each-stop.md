---
"@graview/primitives": patch
"@graview/pages": patch
---

What a screen reader is told, stop by stop. `verify-screen-reader` walks the Roadmap and the todo example through the accessibility tree Chromium and WebKit expose — the bar, the Pages and Scene switch, a list, a record page, a columns lens, a blocks lens, an act's form, the Ask box, and a change from someone else in another tab — and writes what a reader would hear to `docs/screen-reader-walk.md`. What it found is fixed where it was drawn:

- A place followed from the bar puts the keyboard on the new page's heading. The bar's link stays on the page, so the keyboard stayed on it and the page under it changed in silence; only a person typing (the Find box, the seat, a field) keeps the keyboard where it is.
- A change somebody else makes is said aloud as it lands, politely, with who made it: "Ben Okafor: Change Billing across apps: stage → …". Their ops only, never this reader's own or an agent's acting for them, and never one withheld from this seat; the keyboard stays where it was.
- A card in a list or on a board says its name once, first, as the way to it. The link stretched over the card comes before it in the page, and the card's own title in the same words is drawn and not said again (`NamedByItsLink`).
- A value changed in place says which fact it is: "Stage: Shipped", never "Shipped, button". A heading's words are said as they are (`EditableValue`'s new `said`).
- A district's way in is named in words from altitude ("See the features in here"), never by its arrow alone.
- A record's act takes the keyboard into the form it opens, and Escape puts the form away and gives the keyboard back to the act.
- The arrow beside a picture a record is seen in is named by the picture ("Roadmap, in the scene"), not "↗"; the arrows after "In the scene", "as a list", "Connections" and "Sort and filter" are drawn and not said; a flagged row says "Breaks a rule:" before its name rather than "⚠"; a required field's star is drawn and not said ("Name", required — not "Name star"); and the separators between related places and in the arrange bar are no longer read as words of their own.

Bundles: every face is about 2.6 kB larger minified (0.9 kB gzipped) and the embed with the studio handed in about 1.7 kB (0.5 kB), raised in `scripts/budget-raises/a-screen-reader-is-told-each-stop-*.json`; a hosted page's first load and the embed without the studio are unchanged.

Landed beside graview.dev's scene fixes and a kind's list in its declared order, the three together carry 0.3 KB more up front on a hosted page.

Compatibility: no surface changes. `EditableValue` takes an optional `said`, and its button's accessible name is now the fact and its value; a test that finds it by its value alone finds it by `data-graview-field` instead.
