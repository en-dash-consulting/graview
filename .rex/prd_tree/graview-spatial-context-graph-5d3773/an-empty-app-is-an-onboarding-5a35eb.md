---
id: "5a35ebdf-b435-4b0e-ae6e-4cc219ebef25"
level: "feature"
title: "An empty app is an onboarding: the blank-graph example"
status: "completed"
priority: "high"
tags:
  - "onboarding"
  - "example"
  - "dx"
source: "Nick, 2026-09-01: \"we need a sample app that has a context graph defined, but no real sample data. that way the framework can also assist with onboarding. and there is where we really can start integrating some more intelligence into it\""
startedAt: "2026-09-01T06:29:04.530Z"
completedAt: "2026-09-01T06:43:29.697Z"
endedAt: "2026-09-01T06:43:29.697Z"
resolutionType: "code-change"
resolutionDetail: "Sixth app \"seedbed\" ships with a declared community-garden schema and an empty graph; lands on the overview city of empty districts; creates seam derives each kind's beginnings; agent seat plants a reviewable starter garden that makes the rule fire; horizon works from day one; README is the walkthrough; audit/survey/check/tests all cover it."
acceptanceCriteria:
  - "A sixth app ships with a declared context graph and an EMPTY graph — no fixture data — and every surface renders honestly at zero: kind cards say 'none yet', views state what would appear and how to add it, the overview is a city of empty districts that still reads as a map"
  - "The empty state is generative: each kind's card and view offer the add-mutations the schema declares, so populating the graph IS the onboarding path, one derived affordance at a time"
  - "The agent seat is useful at zero: it can propose starter data for the declared schema (the intelligence integration point), and its proposals arrive as ordinary reviewable mutations in the op log"
  - "The harnesses cover the empty state (survey/audit gain the app), because zero-data screens are exactly the ones nobody designs and everybody meets first"
  - "The app doubles as the walkthrough: reaching a populated, rule-checked graph from nothing is documented as the framework's onboarding"
description: "Every example app ships full of fixture data, so the framework has never once rendered its real first screen: a declared schema with nothing in it. That screen is where onboarding lives — and where intelligence earns its way in, because an empty declared graph plus an agent that can propose starter data (through the ordinary derived tool surface, logged and undoable) is the 'describe your domain, get a working app' moment the SaaS ambition depends on. Also the natural test-bed for the builder UX captured in ../graview-saas/prd.md."
---
