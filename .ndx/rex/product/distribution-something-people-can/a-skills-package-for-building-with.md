---
id: "3e30b386-41fb-47e6-a36f-c466e6864f68"
type: "capability"
title: "A skills package for building with Graview"
slug: "a-skills-package-for-building-with"
statement: "Graview ships a skills package that teaches an assistant the authoring moves for building with Graview, each ending in a graview check verdict rather than a claim."
criteria: [{"id":"c1","text":"The skills package shall install alongside the framework and be discoverable by Claude Code and Codex."},{"id":"c2","text":"The skills package shall provide skills for adding a node kind, writing an invariant with repairs, building a custom lens, wiring an agent seat, and porting an existing app."},{"id":"c3","text":"When a skill finishes, it shall run graview check and report the real verdict."},{"id":"c4","text":"Each skill shall point to the three example apps rather than restate their contents."},{"id":"c5","text":"If a skill cannot verify its own outcome, the skill shall say so instead of claiming success."}]
priority: "high"
---

Graview is unusually well suited to being built WITH by an assistant, because the framework can already tell one whether it got it right: `graview check` reads the declaration and reports an edge to an undeclared kind, a rule with no invariant, a lens role nothing binds.

So the skills should teach the authoring moves — add a node kind, write an invariant that names its repairs, build a lens, wire an agent seat, port an existing app — and every one of them should END IN A CHECK rather than in a claim. A skill that says "you have added a kind" is worth much less than one that runs the checker and shows the verdict.

The three apps here are the worked examples the skills should point at, since each was built to prove a different thing.
