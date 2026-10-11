---
"@graview/tools": patch
"@graview/core": patch
"@graview/skills": patch
---

A host wires its turn from the loop alone: `@graview/tools/turn` (FR-161). `turnThroughMessages` was exported only from the root of `@graview/tools`, and a host that imported it there, as the notes for FR-160 said to, carried the root's agent, providers and the rest in its first paint: Graview Cloud's shell went from 562 KB to 646 KB for forty bytes of wiring. The new entry `@graview/tools/turn` carries `turnThroughMessages`, `TURN_STEPS` and the `MessagesBlock`, `MessagesStepRequest` and `MessagesStepReply` types and nothing else; bundled on its own it reads one module and weighs under 2 KB. The root still exports them. The scaffolder's link-mode aliases and the example apps' name the new entry, and the seat skill says where to import it from.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged; `capabilities().shipped` gains FR-161. New: the `@graview/tools/turn` entry. What a host does: import `turnThroughMessages` from `@graview/tools/turn`; a host that imported it from `@graview/tools` on the first ask, to keep it out of the first paint, can import it up front instead.
