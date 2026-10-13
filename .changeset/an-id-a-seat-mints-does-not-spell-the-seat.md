---
"@graview/core": patch
---

An id a seat mints for itself does not spell who the seat is, under FR-55. A seat that may not see every record of a kind minted `room:green.person-gus`, and every seat that saw the room read Gus's id in it — a seat the policy keeps people's records from among them, whose served log withholds an op by an author it may not see. The mark is now `seatMark(<the seat's id>)`, seven letters and digits that are the same for the seat on any store (so a page's guess and its host's answer agree) and that no other seat's label mints: `room:green.k3j9x2a`. `seatMark` is exported from `@graview/core`, and `mintId` is the one rule an act's `freshId` and an import mint by.

Compatibility: ops unchanged in shape. An id minted for a seat that may not see every record of a kind is `<kind>:<slug>.<seatMark>` where it was `<kind>:<slug>.<seat slug>`; ids already minted are kept as they are. A seat that sees every record of the kind mints as before.
