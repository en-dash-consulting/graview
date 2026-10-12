---
"@graview/tools": patch
"@graview/core": patch
---

A host's turn that fails says why in the host's own words (FR-166). The seat caught a failed model step and wrote "(AI didn't answer just now, so this is from the app alone.)" whatever had happened, so a refused key, a rate limit and a step the host would not read all read the same, and the sentence a host threw to explain it never reached the reader. Now a plain `Error` a host's `turn` or `complete` throws is carried in the aside: "(AI didn't answer just now: The model is busy right now; try again in a moment. This is from the app alone.)". Only a plain `Error` is said: a `TypeError` from a fetch that never left, and every other kind, is the machine's and keeps the old aside. The sentence is one line of at most 160 characters, with its brackets taken out so the aside stays whole. `capabilities().shipped` gains FR-166.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged; `capabilities().shipped` gains FR-166. What a host does: throw an `Error` whose message is a sentence a reader may see when its turn or completion cannot answer; throw anything else to keep it to yourself.
