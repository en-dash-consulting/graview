---
"@graview/core": patch
---

"Keep this link" tells a seat nothing of a record it may not see (FR-172, FR-55). `keep-link` names the link's ends as plain ids, so the store's check that a call names no hidden record never read them: a seat that guessed an id kept a hidden record's link when one was there and was refused "missing edge" when none was — an answer that said which guess was real — and could make a link it could not see ordinary. A keep whose either end the seat may not see is now refused as `missing`, in the graph's own words, alike whether the link is there or not.

Compatibility: the wire's refusals are unchanged in shape; a `keep-link` naming a record the seat may not see is refused `missing` where it could land.
