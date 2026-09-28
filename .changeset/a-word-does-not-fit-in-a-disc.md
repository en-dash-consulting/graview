---
"@graview/primitives": patch
"@graview/skills": patch
---

The board lens draws a token when a code is a word, and shelves a zone's slots when the arrangement is categories. A 34-pixel disc holds "GK" and "LB"; it never held "Outbound", which spilled past its ring, or "Prop-fin", which wrapped at the hyphen inside it — and a slot's code is its whole label whenever nothing shorter is bound, so most boards outside a pitch were boards of words in circles. A board whose every code is three characters or fewer still draws discs. Any longer and the whole board draws tokens: a pill sized to its code, cut with an ellipsis past the width of a long word and carried whole in the title, with whoever is in it on the line beneath, INSIDE the mark — so a mark is one box whose size is known, and two names on a shared seat can no longer land on the row below. `occupantLabel: "given"`, which shortened those names to hide the collision, is gone.

`arrange: "shelf"` is for a board whose x and y are categories rather than coordinates — a load map whose rows are "still owns", "shared", "handoff". Each zone becomes a band with its name as a heading row of its own, and its slots flow into rows in the domain's order, sized to what they hold; nothing on a shelf can overlap anything, and a zone's name can no longer be clipped to the middle of the word by a fifteen-pixel rail. The default, `"exact"`, is unchanged for a pitch or a seating plan, and its rail now ends a name that does not fit with an ellipsis and carries it whole in the title.

The `graview-lens` and `graview-new-app` skills and the package READMEs say so: the board's two marks and its two arrangements, and that a new app's pages face wants the scene's `views` to land on its gallery.
