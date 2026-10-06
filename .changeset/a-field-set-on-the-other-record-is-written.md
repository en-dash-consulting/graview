---
"@graview/core": patch
---

A field an act sets on the record at the other end of a link is written by that act, so a derived edit no longer offers it (FR-110 over FR-115). An act `on: "person"` that `connects: "owns"` and says `"setsOther": { "state": "shared" }` sets a thing's state, but its `writes` names only its subject's fields, so nothing counted the thing's `state` as written and "Change the thing" offered it freely — a person could mark a thing shared without sharing it. A compiled document act now says `writesOther: { thing: ["state"] }`, by the kinds at that end of the link, and `fieldWriters` (which the derived edit, `field-without-writer` and the calendar read) counts it. A TypeScript mutation may say `writesOther` too.

Compatibility: unchanged for stored data, ops and the wire. A derived tool's input schema changes for an unchanged declaration only where an act sets a field on the other end of a link and nothing else wrote it: that kind's `edit-<kind>` no longer takes the field (none of the conformance fixtures or Cloud templates does). `MutationDefinition` gains an optional `writesOther`.
