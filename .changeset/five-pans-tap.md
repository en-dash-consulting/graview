---
"@graview/react": patch
"@graview/render": patch
"@graview/primitives": patch
---

Fixes from a code review of the constellation work: a selection is resolved
onto what is actually drawn before it is compared with a connector's endpoints
(it blanked the whole Graview otherwise), clicking a kind card up there selects
it, and the connector stroke treatment has one home so a legend cannot drift
from the line it claims to show. `GraviewProvider` gains `initialSelection`.

Also: a lens now gets the schema from the provider, so an optional field absent
on one node is data rather than a binding error — one unplanned task used to
throw for a whole view.
