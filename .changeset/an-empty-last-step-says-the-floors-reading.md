---
"@graview/tools": patch
"@graview/core": patch
---

A model's last step that answers nothing says the app's own reading, as a failed turn does (FR-168). A turn whose last step answered one output token was shown "The answer came back in a shape I could not read. Ask again in other words." though the app had read the ask and had a proposal ready. Now an answer that is empty, only whitespace, JSON that does not parse, or JSON that says nothing and proposes nothing is no answer: the seat says what the app read, its proposals with it, and the failed turn's aside, "(AI didn't answer just now, so this is from the app alone.)", and nothing is marked as answered with AI. A model's prose is still its answer. `llmResponder` on its own, with no floor to fall back on, still says the shape sentence, and now marks it `unsure`. `capabilities().shipped` gains FR-168.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged; `capabilities().shipped` gains FR-168. A reply `llmResponder` could not read carries `unsure: true`. What a host does: nothing.
