---
"@graview/core": patch
---

The upgrade says why it is not taken back. Asked to undo a migration, the store said it "was done before the declaration changed (migration 1→2 …)", naming the upgrade as what stood in its own way; it now says the upgrade is the change of declaration itself, and that taking it back would write the old declaration's values into the new one. (W-185, the eighth walk.)

Compatibility: ops and primitives are unchanged — what may be undone is as FR-27 decided, and only the sentence for the upgrade itself is new; stored formats, the wire, the document format, the compiled format, check finding codes and tool names and schemas are unchanged.
