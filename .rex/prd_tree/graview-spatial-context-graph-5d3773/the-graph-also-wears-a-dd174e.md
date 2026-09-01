---
id: "dd174e35-ab9e-4e6a-9c20-83d7ab6c77a3"
level: "feature"
title: "The graph also wears a traditional face: a routed webapp derived from the same declaration"
status: "pending"
priority: "high"
tags:
  - "sdk"
  - "templating"
  - "responsive"
  - "mobile"
  - "distribution"
source: "Nick, 2026-08-31: \"the framework also producing a more traditional set of interfaces, or allowing users to do that with custom definitions... an sdk/api to interface with, and we ship with a couple defaults... necessary for backwards compatibility and mobile/responsiveness... spin up an entire application almost only by specifying config about a context graph (its node types) and probably some starter data\""
acceptanceCriteria:
  - "From one defineApp declaration plus starter data, the framework can serve BOTH the spatial Graview workbench AND a traditional react-router webapp — index pages per kind, a record page per node with its relationships as links, cross-linked navigation — with no per-app page code required"
  - "The traditional face is derived from the same sources the spatial one is: schema (fields, edges, plurals, descriptions), mutations (forms and actions), invariants (validation and problem lists), permissions (auth-scoped visibility and actions), and the op log (history on a record)"
  - "A templating/SDK seam lets an installation replace or extend the default pages with custom definitions, the way lenses and views already extend the scene — defaults ship, customs plug in through a declared API rather than a fork"
  - "The traditional face is responsive and usable on mobile, which the spatial scene is not required to be — this is the backwards-compatibility and small-screen story"
  - "Deep links interoperate: a record page and its spatial stop reference each other (same ids, convertible URLs), so the two faces are one application"
  - "graview check verifies the derived pages the way it verifies the scene (routes exist per kind, no orphaned links, contrast holds)"
  - "An example app (or the todo example) demonstrates both faces from the one declaration"
description: "The spatial workbench is a novel way of seeing a context graph; it should not be the only way the graph can be seen. This feature makes the framework produce, from the SAME declaration that drives the scene, a traditional web application: a react-router app with pages — a list page per kind, a record page per node showing its fields and its relationships as ordinary links, forms derived from mutations, problems from invariants, visibility from the permission policy. Ship a couple of default page templates; expose an SDK/API seam so an installation can bring its own templating, the way lenses already bring their own pictures.\n\nWhy: backwards compatibility with the web interface paradigms people are used to, mobile/responsiveness (the spatial scene is a desktop instrument), and the pitch that you can spin up an entire application by specifying the context graph config (node types, edges, mutations, rules) plus starter data — and get a deep/cross-linked, relational, auth-scopable interface with both a novel spatial face and a familiar routed face.\n\nRelationship to what exists: the derivation machinery is already all there — default views render any kind at three fidelities with zero custom code, affordances derive forms, permissions narrow surfaces, the folder of harnesses verifies claims. This feature points the same machinery at a page/router target instead of a scene target. The launcher's liveness/routing work and the smoke-install scratch-app rehearsal are the natural proving grounds."
---
