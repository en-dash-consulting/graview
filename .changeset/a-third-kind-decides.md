---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A decision provider is a third kind of intelligence, and the declaration says so. `intelligence[].kind` accepts `"decision"` beside `"graph"`, `"llm"` and `"external"`: a provider that answers typed questions — a Choice over named options, a truth, a Score over an ordered rubric — with a confidence, and never prose. `providerCan(provider, "prose" | "decide" | "propose")` derives what each kind serves from the kind alone, so a surface asks whether a provider can before offering it.

`graview check` holds a decision provider to what it can decide: an act on its allowlist whose required arguments want text, a date or an unbounded number is one it could never call, and is refused (`intelligence-decision-cannot-call`, naming the act and the argument); a paste or MCP door on one is words out and words back to something with no words (`intelligence-decision-prose-door`). `undecidableArguments(mutation)` is the function behind it, exported for the surfaces that will derive questions. `graview describe` and the generated docs read a decision provider out as what it is, and the `Door` draws none for it — a prompt-out answer-back door is a chat offered to a thing that cannot hold one.
