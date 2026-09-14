---
"@graview/react": patch
"@graview/primitives": patch
"@graview/studio": patch
---

A district stays a district whatever picture the address names — and the studio stops minting ids in the layout's namespace.

Three things, all found by opening Rota's installation and its studio and looking at what was actually drawn.

**A place is a picture OF a group, not of every group.** The scene handed `in.view=<slug>` to every group it drew, so pressing "Who may do what" and then looking at something else left the slug in the stop, where the PEOPLE district — which is not what you are looking at — drew the policy lens instead of itself: no name, no count, no figure, no way in, just the words "Who may do what · 3 roles" floating where a district used to be. The same thing turned the Shifts card into "The week · 10". The slug now reaches only the group the address focuses, which is what the code's own comment always said it did.

**A lens's glyph is a mark, not a caption.** `ReachView` returned a bare `<span>` at glyph fidelity where every other lens returns a `Chip`.

**`kind:` belongs to the layout.** It is where a district card's id comes from, and the studio minted `kind:rule` for an app's own kind called "rule" — the same string as the RULES district's card. Every app in this repository declares a kind called "rule", so in every one of their studios the edge from a rule to the kind it judges resolved to the district it started from and was drawn as a loop: a dotted circle labelled OVER, saying a rule judges a rule. The studio's kind nodes are `declared:<name>` now, and a test holds the namespace.

Also: the studio's agent can name a new role or kind. "add a new Role for Participant" was not recognised by the graph-native floor — it only matched an act whose title appeared verbatim — so the turn fell through to whatever model was configured, which proposed `add-role` with no label and got a validation refusal. The floor now takes a name from quotes, from "called"/"named"/"for", or from in front of the word itself, asks for one when there is none rather than proposing an act that cannot apply, and says so when the name is already taken.
