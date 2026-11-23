---
"@graview/core": patch
"@graview/tools": patch
---

The several bar judges a seat whose profile's person is not made yet on one copy of the store, HQ feature:f-several-permits-copy-per-record. Under a policy with an own-end grant, `permits` judges such a seat with its person made, as `apply` does, and it made a fresh copy of the store for every call: the bar asks it of every chosen record for every act, so two thousand chosen ideas took about 7 seconds against about 110 ms for a member already there. `permits` now judges on the copy `wouldDo` already keeps while the store's `version` stands, one per recompute, and two thousand chosen take about as long as they do for any other seat. The verdicts are the same: a call that names a record made in its own change, a proposal, the app's own actor, and a profile `apply` would not take as given are still rehearsed whole. Held by a new unit test of core (`permits-judges-a-person-not-made-yet-on-the-copy-would-do-keeps`) and one of tools (`the-several-bar-judges-a-person-not-made-yet-on-one-rehearsal`), which count the copies, compare each verdict with a rehearsal of its call alone, and time the bar against a member's.

Compatibility: the look — unchanged. The JavaScript API — unchanged; `permits` answers as before, sooner. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
