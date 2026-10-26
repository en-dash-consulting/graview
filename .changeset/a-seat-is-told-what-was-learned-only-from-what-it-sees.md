---
"@graview/tools": patch
---

`graview mcp` tells its seat what the app's own actor learned only from what that seat sees. What was learned from use names the values people keep writing in a field — "Make vendor's tier a choice of Gold and Silver", with the values in its edits — and `list_app_suggestions` handed a seat the list learned over the whole store, so an agent seated as a member, whose sight hides a vendor's tier and every contract, read the tiers and the contracts' statuses that `get_node` and `seenBy` kept from it. Now `learningOf` takes the `seat` it is told to, and learns from that seat's records and log as its sight serves them; `graview mcp` passes its principal, so a field or a kind the seat's sight hides says nothing, and a seat that sees everything is told what it was before. `a-seat-is-told-what-was-learned-only-from-what-it-sees` holds it: an owner is told the tiers and the statuses, a member's agent neither, and two stores that differ only in what the member may not see tell it the same.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. What Graview Cloud does: a host that hands a runtime `learned` learns it for the seat it serves, with `learningOf(…, { seat })` or from `store.seenBy(seat)`.
