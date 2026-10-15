---
"@graview/core": patch
"@graview/skills": patch
---

A document's rule may be repaired by an act from the other end of its relation. A rule over findings that requires `exists(in('resolves'))` (a serious finding has an initiative) is naturally repaired by `resolve-finding`, an act on the initiative that says `fromTheOtherEnd: "Name the work that fixes it"` and which a finding's page already offers; `graview check` refused it as `repair-wrong-kind`, because the act's subject is not the kind the rule judges. An act that connects or severs a relation between the judged kind and its own subject, takes the judged kind as an argument and says how it reads from that end is now accepted, and the rule hands it the judged record as the far end (`to`), labels the repair with the far end's words and leaves the subject for the person to choose (`missing: ["id"]`), as the record page does. Without `fromTheOtherEnd`, or without such a relation, it is still `repair-wrong-kind`, and the fix now says this third way out. An `expressionRule` in TypeScript still hands every repair `{ id }`, so it is held as before.

Compatibility: the declaration and check finding codes: a document that compiled still compiles, and one refused only for `repair-wrong-kind` on such an act now compiles; a violation's repair for that act carries the far end's argument and `missing: ["id"]` where it carried `id`. Ops, stored formats, the wire and derived tool schemas are unchanged.
