---
id: "3e30b386-41fb-47e6-a36f-c466e6864f68"
level: "feature"
title: "A skills package for building with Graview"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "A skills package installs alongside the framework and is discoverable by Claude Code and Codex"
  - "Skills cover: new node kind, invariant with repairs, custom lens, agent seat, and porting an existing app"
  - "Every skill finishes by running graview check and reporting the real verdict"
  - "Skills reference the three example apps rather than restating their contents"
  - "A skill that cannot verify its own outcome says so instead of claiming success"
description: "Graview is unusually well suited to being built WITH by an assistant, because the framework can already tell one whether it got it right: `graview check` reads the declaration and reports an edge to an undeclared kind, a rule with no invariant, a lens role nothing binds.\n\nSo the skills should teach the authoring moves — add a node kind, write an invariant that names its repairs, build a lens, wire an agent seat, port an existing app — and every one of them should END IN A CHECK rather than in a claim. A skill that says \"you have added a kind\" is worth much less than one that runs the checker and shows the verdict.\n\nThe three apps here are the worked examples the skills should point at, since each was built to prove a different thing."
---
