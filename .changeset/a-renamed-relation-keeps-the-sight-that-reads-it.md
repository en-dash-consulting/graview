---
"@graview/core": patch
---

A document edit that renames a relation carries the sight that reads it. `rename-relation` moved every act, rule and view that named the relation but not a sight `via` it, so Secret Santa's `givenBy` renamed left the participants' sight reaching a relation nobody declares, and the document no longer compiled. The sight now follows the new name. `remove-relation` is refused while a sight reads the relation, as it is while a lens draws by it — `a sight shows what "givenBy" joins to each seat's own record` — since dropping the sight could show everybody what it kept to each seat's own, and the policy is not an edit's to change.

Compatibility: the document format, the compiled format, ops, stored formats, the wire, check finding codes and tool names and schemas are unchanged. `editDocument` refuses `remove-relation` on a relation a sight reads, where it used to leave the sight naming a relation that is gone.
