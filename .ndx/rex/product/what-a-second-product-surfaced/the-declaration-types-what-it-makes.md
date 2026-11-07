---
id: "90407054-fba2-4232-8413-f4e29822ba9d"
type: "capability"
title: "The declaration types what it makes, and the checker asks the questions that matter"
slug: "the-declaration-types-what-it-makes"
statement: "A Graview declaration keeps the app's own kind names when it spreads the installation's kinds, and graview check warns only about what a person can act on."
criteria: [{"id":"c1","text":"When an app spreads installation.kinds into createSchema, declareInstallation shall return its kinds as concrete NodeDefinition<'user', …> and NodeDefinition<'invitation', …> so the app's own kind names stay intact."},{"id":"c2","text":"When an app declares an edge with to: ['user'] and spreads installation.kinds into createSchema, the type checker shall accept the edge without a cast."},{"id":"c3","text":"Where a module declares itself required (declareInstallation({ required: true }) or modules: { x: { optional: false } }), the declaration shall accept it as a module that can never be off."},{"id":"c4","text":"When a module is declared required, graview check shall skip module-edge-leak for that module."},{"id":"c5","text":"When an empty kind card's creating act needs another kind first, the card shall say which kind is needed and link to it, derived from the act's nodeRef inputs."},{"id":"c6","text":"When fieldRoles and a lens binding disagree about the same field, graview check shall emit a finding."},{"id":"c7","text":"When an app's lenses are implemented inside the app, graview check shall emit lens-authored-here as an observation listing those lenses."},{"id":"c8","text":"If no test outside the app's own kinds builds an authored lens, graview check shall warn with lens-reuse-unproven."}]
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
priority: "high"
---

declareInstallation returns its kinds untyped, so an app cannot point an edge at a person without a cast; a module that can never be off is still warned about; creates onboards only the first kind in a chain and nobody says so; fieldRoles and lens bindings do one job in two places; the reuse test is the skill's best idea and nothing checks it.
