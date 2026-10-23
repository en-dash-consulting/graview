---
"@graview/tools": patch
"@graview/core": patch
"@graview/ship": patch
"@graview/studio": patch
"@graview/skills": patch
---

A host's model is asked with one object and answers with one, so it can be handed a framing, pictures and a way to give up, and say what the call used, without breaking again. `Completion` was `(prompt: string) => Promise<string>`; it is `(request: { prompt, system?, images?, signal? }) => Promise<{ text, usage? }>`, each picture `{ mediaType, data }` in base64 and `usage` `{ inputTokens, outputTokens, costUsd? }`. `openAiCompatibleCompletion` and `xaiCompletion` send the framing as a system message and the pictures as image parts, give up on the caller's signal and read what the call used; `localCompletion` takes the framing; the inline AI hands the framing over apart from the ask rather than joined to it, and `completionDecide` reports the completion's usage. The dev server's door (`aiDevProxy`, `aiThroughDevServer`) takes `{ prompt, system?, images? }` and answers `{ text, usage? }`. The Fast slot's contract — `Decide`, `Decided`, `Answer`, `ChoiceAnswer`, `NoulAnswer`, `ScoreAnswer` and `Usage` — is in a module of its own rather than Jev's, by the same names on `@graview/tools`.

Compatibility: breaking in the API a host's seat reaches, before 1.0 — every `HostAi.complete` and every caller of a `Completion` takes and returns the object (`async (prompt) => text` becomes `async ({ prompt }) => ({ text })`). Additive on the dev server's door: `system`, `images` and `usage` are optional fields. Ops, stored formats, the wire, the document format and tool schemas are unchanged.
