---
"@graview/ship": patch
---

A seat with no id stands only for itself. A presence is keyed by the seat that says it, `kind:id:session`, so a client cannot say where somebody else is or that they have gone — but a seat a host's `seatOf` served with no id (an anonymous reader) was keyed by whatever participant it claimed on `POST /graview/here`, and its `POST /graview/leave` matched every key. It could stand in Alice's place under a name of its choosing, or take anyone off the map. Now it is keyed `kind::session` whatever it claims, in a namespace no identified person stands in, with a session that holds no colon, and it leaves only keys there (`ownsParticipant`). A seat with an id is keyed and leaves as before. `a-seat-with-no-id-stands-only-for-itself.test.ts` holds it.

Compatibility: the wire — a seat with no id is answered `kind::session` on `/graview/here`, where it was answered the key it claimed; a client that sends back the key it was answered, as `openRemote` does, keeps its place. Ops and primitives, stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged.
