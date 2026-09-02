---
"@graview/core": patch
"@graview/tools": patch
"@graview/primitives": patch
---

A field you could set at creation, you can change. Every kind with
settable fields no declared mutation writes gets a derived, titled edit
act — `edit-<kind>`, "Change the drill" — registered by the store like
any other: logged, undoable, judged by the invariants, and by the policy
through the declared acts that already write or create the kind, so who
may edit a drill is whoever may already retime or design one, with no
second list. Opting out is `fixed` on `defineNode` — the field and the
sentence saying why it never changes. Mutations can declare the fields
they `write` (as `connects`/`severs` declare edges), and `editableFields`
believes a declaration over the name-match guess: `finish`/`reopen`
writing `done` stop being invisible, and a writer that takes no value is
offered as its acts rather than a text box. `graview check` gains
`field-without-writer` (a settable field the derived edit cannot reach,
symmetric with `edge-without-severer`), `writes-unknown-field`,
`fixed-unknown-field` and `fixed-but-written`; generated agent docs list
the derived acts alongside the declared ones.
