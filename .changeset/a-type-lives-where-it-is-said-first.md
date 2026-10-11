---
"@graview/core": patch
"@graview/embed": patch
"@graview/tools": patch
"@graview/primitives": patch
---

A type lives where it is said first, so six of the import cycles that were left only in types are gone. The kit's types (`Kit`, `ConnectorKit`, `KitOverrides` and the rest) are the theme's, beside the `Brand` that carries them; `PagesArrangement` is the view registry's, which arranges by it; `Finding` and `Severity` are the check context's, where a finding is added; `validateScaffoldOptions` asks only the options a name can be wrong in; `settleAt` asks only the embed's options it reads; the seat's `SeatMove` and `SeatOffer` are the conversation's, whose replies carry them (`@graview/tools/go` still says both); and `KeptLens` is the reader's lenses'. Every name is exported from the same entry as before. Three are left, each for a reason: a `Store` is declared beside the store it describes; the document's views and its description of a place are being changed by this round's other work.

Compatibility: ops, stored formats, the wire, the declaration and check finding codes, and tool names and input schemas are unchanged — only where a type is declared moved, and every entry exports what it did; the hosted page's first load is the same to the byte.
