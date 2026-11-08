---
id: "9135e25e-a3e4-4791-9f0a-88910f36884a"
type: "capability"
title: "An id a seat asks for or is minted, and a single-source link it sets, tell it nothing of a hidden record"
slug: "an-id-a-seat-asks-for-or-is-minted-and"
statement: "A seat that may not see everything is told nothing of a hidden record by the ids it asks for or is minted, or by the single-source links its acts set."
criteria: [{"id":"c1","text":"When a create asks for an id that a record the seat may not see holds, the store shall answer the seat the same as it would for a free id, or with a refusal the seat also gets for an id nobody holds."},{"id":"c2","text":"When the store mints an id for a seat from a label, the store shall mint the same id whether or not a record the seat may not see holds that label's id."},{"id":"c3","text":"When an act sets a single-source link that replaces a hidden record's link, the store shall serve the act to the seat whole, with what the seat may see."},{"id":"c4","text":"Each of these behaviours shall be held by a world-with and world-without comparison, as an-act-runs-under-its-callers-sight.test.ts holds the rest."}]
tags:
  - "roadmap"
  - "graview-cloud"
  - "FR-55"
  - "sight"
source: "The review before 0.1.24 (review/after-0-1-23), following up #214: an act runs under its caller's sight, and the store's own bookkeeping still reads the whole store"
priority: "medium"
resolution: "Shipped on feat/fr-176-tick-and-fr-55-hidden-ids: a seat that may not see every record of a kind mints ids of its own (`room:green.person-gus`) and may not ask for one (refused alike, `invalid`); `setSingleSource` writes the new link first, so taking a hidden record's link is served to the seat whole. World-with/world-without tests hold each; docs/stability.md lists none of the three as known limits."
---

#214 made a hidden record to an act what an absent one is, and the review before 0.1.24 took a removal's cascade out of the list (a link the seat is not served is no part of its op). Three of the store's own bookkeeping reads still differ for a hidden record, and are documented in docs/stability.md as known limits. (1) A create that asks for an id (takesAnId) that a hidden record holds is refused "Id … is already taken"; an absent one would be made. Ids are unique across the store, so making it is not an answer; a fix gives every seat that may not see everything ids no guess can collide with (a seat-scoped or random suffix), or refuses a requested id the same way whether or not anybody holds it. (2) freshId steps past a hidden record's id: a guest's "Green" is room:green-2 when a hidden room:green exists. (3) setSingleSource removes a hidden record's link into the same record; that op names the hidden id and is served to the seat withheld, and the seat cannot undo it.
