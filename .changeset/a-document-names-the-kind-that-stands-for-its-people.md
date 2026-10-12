---
"@graview/core": patch
"@graview/studio": patch
---

A document names the kind that stands for its people (the Graview Roadmap's f-people-kind). `"people": true` on one kind says that a record of it whose id is a principal's id is that person — the record Graview Cloud makes for each member under their principal id. A declaration says the same with `people: true` on `defineNode`, and the installation's `user` says it. `self` grants and `own` sights read a principal's id as before; the people kind is what `$me`, a grant held to your own end of a link and a sight via a relation read it as. `describeApp` says it ("The people are the participants: a participant whose id is a member's principal id is that member."), a kind's JSON Schema says `"x-graview-people": true`, and `toDocument` and the studio carry it. `graview check` refuses two kinds that both say it (`people-ambiguous`) and a policy that reads a principal's own record with no kind saying it (`people-unsaid`).

The hosted page pays for what it carries of these four changes up front by reading a grant's and a sight's roles one way, a mutation's subject kinds one way, and a call's named records once in the store: 586,874 bytes up front where main is 586,913, and 545,887 handed a compiled app where main is 545,948.

Compatibility: additive. The document format gains `kinds.<kind>.people` within `graview-document@1`; a build that predates it refuses it by path. Check finding codes: `people-ambiguous` and `people-unsaid` are new, errors only about declarations that say something that could not be said before. A kind's JSON Schema gains `x-graview-people` on the people kind. Ops, stored formats, the wire and tool names and schemas are unchanged. New: `NodeDefinitionSpec.people`. What Graview Cloud changes: say `"people": true` on the kind its member records are (f-member-records), with each record's id the member's principal id.
