---
"@graview/core": patch
"@graview/tools": patch
---

Binding a person, as a host needs it. Graview Cloud offers an invitation for a person an organizer entered, and asked whether that record may be bound by rehearsing `bind-person` for a placeholder seat. `mayBind(store, record)` on `@graview/core/binding` now answers without a seat: `{ ok: true }`, or `{ ok: false, reason }` with the sentence `bindPerson` would refuse it with (not one of the people, someone else's record already, not there, or an app with no people). Nothing is applied or rehearsed. `seatsKept(principal)` is on the main entry beside `unseatedOp`, so a host strips a raw log for a reader by the framework's own rule: `unseatedOp(op, seatsKept(reader))`. And with them, security and reliability fixes for bound people. Held by new unit tests of core (`binding-as-a-host-needs-it`) and tools (`bound-people-in-the-tools`).

Compatibility: ops and primitives — an op's format is unchanged. Stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The JavaScript API is additive (`mayBind` on `@graview/core/binding`; `seatsKept` and `KeepsSeat` on `@graview/core`). What Graview Cloud does: ask `mayBind` in place of its rehearsal and strip a raw log with `seatsKept`.
