---
"@graview/core": patch
"@graview/ship": patch
---

The friction counts a person reads leave that person's own events out. `GET /graview/friction` said a word, a search or a question once two distinct people had used it, and the reader was one of the two: a member could post a list of guessed words and read back which of them exactly one other person had searched for or asked. `frictionOf` takes `reader` now, and drops that person's events (an agent acting for them among them) before anything is counted, so a group is said only when `minPeople` people other than the reader share it. The friction door passes the asking seat, and `aiContextOf` passes its principal to the digest a model reads beside them. Core's friction test holds that a reader's own guesses confirm nothing one other person typed, and ship's that a member posting another's question as a guess reads no count of it.

Compatibility: ops and primitives, stored formats, the wire's shape, the declaration and derived tool names and input schemas — unchanged. The counts `GET /graview/friction` answers no longer include the asker's own events, so a group two people shared, one of them the asker, is no longer said to them.
