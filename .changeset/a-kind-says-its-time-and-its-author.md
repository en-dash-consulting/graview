---
"@graview/core": patch
"@graview/pages": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A kind can say which field is its natural time and which its author. `fieldRoles` was not a document key at 0.1.20, so n-dx could not declare a commit's `committedAt` its time nor its `author` who made it: commits had no declared order, and the Runs timeline bound its date in the lens. A document's kind says `fieldRoles` as `defineNode` does — `"fieldRoles": { "when": "committedAt", "who": "author" }`, and any role a lens binds by name — and the framework reads two of them. `when`: a list of the kind opens newest first by it at any length, indexed by year when it is large (it was a large list only, by a `start` role, which a kind that wants it now says as `when`); a timeline or calendar that binds no `start` for the kind draws each record there (`withNaturalTime`, exported for a lens of an app's own). `who` and `when`: an unchosen glance leads with them, before the fields as declared. `graview check` refuses a role naming no field (`field-role-missing-field`, now at `kinds.<kind>.fieldRoles.<role>` for a document) and a `when` that is no date or a `who` that is no name (`field-role-ill-typed`); a lens that binds no start passes where the kind says `when`. `graview describe` lists each kind's roles; a diff says a role that moves; renaming a field moves its role, and removing one lets it go; `toDocument` carries a kind's roles.

Compatibility: ops, stored formats, wire messages, the compiled format, tool names and schemas are unchanged. New: `kinds.<kind>.fieldRoles` in the document, the `when` and `who` roles, the finding code `field-role-ill-typed`, `withNaturalTime` on `@graview/primitives`. Changed: a large list no longer opens newest first by a kind's `start` role — say `when` (Discography's albums do); a list of a kind with `when` opens newest first at any length; an unchosen glance leads with `who` and `when`.
