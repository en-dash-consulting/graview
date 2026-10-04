---
"@graview/core": patch
"@graview/skills": patch
---

`graview check` warns `sight-hides-required-ref` when a role may see a kind but not what every one of its records must name. A record whose required field names a record its seat may not see is withheld from that seat whole (FR-55) — clearing the field would serve it broken — so with editors seeing vendors but not categories, and `category: nodeRef(["category"])` required on every vendor, an editor sees no vendor anybody else wrote: a policy that reads "editors see vendors" serves them none. The warning says it in those words — "An editor will never see vendor records somebody else wrote, because each names a category (its required field "category") they may not see …" — and the fix: let the role see the target, make the field optional so it is cleared instead, or say the link with an edge. It is asked of every role a grant or a sight names, and, when a sight is for everybody, of a seat with no role; it reads a field's declared `nodeRef` kinds, so a plain string that happens to hold an id is not judged. The permissions skill says when it fires.

Compatibility: check finding codes — additive: `sight-hides-required-ref` is a new warning, and a declaration that checked clean still compiles and checks without an error. Ops, stored formats, the wire and derived tools are unchanged.
