---
"@graview/core": patch
---

Words taken out of their capsules are measured where they now stand (FR-117). The design pass wrote a district's name, a drive-in's showings and the places on the bar straight onto the ground and the bar, and the showing a drive-in is on is drawn in the accent there — but the accent `brandFromAccent` derives was tuned to clear 4.5:1 on the panel only, and in the light scheme the ground is a shade darker than the panel. A green, teal, blue or grey accent landed at 4.1–4.3:1 on the ground, under AA, and `graview check` said nothing because the pair was not on its list. `TEXT_PAIRS` now holds the accent, the ink and the muted ink on the ground, and the muted ink on the bar, and a derived accent is moved the least it takes to clear both the panel and the ground; the shipped schemes already did.

Compatibility: unchanged for stored data, ops, tool schemas and the wire. A brand derived from one accent may come out a shade darker in the light scheme; a brand that sets its own accent and fails it on the ground is now a `graview check` finding.
