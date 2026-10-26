---
"@graview/core": patch
---

A record withheld from a seat whole is refused as one that is not there, whatever its grant says. A task that must name its project, shown to a member who may see tasks but no project, is withheld from the member whole; asked by a grant drawn by kind ("a member, on tasks"), the store still read the record's kind to judge it, so a guessed id that named such a task was refused `missing` and one that named nothing `forbidden`, with the roles that could — and `permits` answered the two differently. The subject's kind is now read only from what the seat is served, as `missingFor` reads it, so both are refused alike. An id minted for that seat no longer steps past such a record either: a kind whose records must name one of a kind the seat does not wholly see is not wholly seen (`seesEveryRecord`), so the seat's ids for it are its own (`task:withheld.<mark>`) rather than the plain slug, or a random suffix where a withheld record held it. `a-refusal-is-no-oracle.test.ts` holds both.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. A seat whose sight hides a kind another kind's records must name is minted its own ids for that kind, as a seat with an `own` or `via` sight already is.
