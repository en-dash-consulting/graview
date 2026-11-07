---
id: "aa8097b1-89e9-49b2-acf9-a998476a0f0b"
type: "change"
title: "Modules: named parts of a declaration a workspace can turn on and off"
slug: "modules-named-parts-of-a-declaration-a"
intent: "A deployed app (the household example as a hosted product) needs to scope itself per workspace: one household wants Vehicles and meal planning, another wants neither. Today an app's declaration is all-or-nothing — kinds, mutations, invariants, lenses and seeds arrive as one schema.\n\nThe framework concept: a MODULE is a named, declared subset of an app's surface — node kinds, edge kinds, mutations, invariants, views/lenses, sample seeds — with dependencies between modules stated explicitly (meal-planning may require people; vehicles may stand alone). defineApp gains a modules registry; a store/provider takes an enabled-set at construction (config or data, not code). Everything already derives from the declaration, so disabling must flow through the same seams: the kinds shelf omits disabled kinds, affordance providers skip their mutations, invariants are not evaluated, graview check validates per-module closure (no enabled kind may declare an edge to a disabled kind unless the edge is declared optional), llms.txt and generated agent tools include only the enabled surface. Disabling a module with existing data does NOT delete: its nodes drop behind the horizon (reuse lifecycle machinery — \"module off\" is a horizon, not a delete) and re-enabling brings them back intact.\n\nWhy framework-level: graview-cloud (the hosted platform) needs per-workspace toggles wired to entitlements/billing tiers, and the household product/the coaching example-graview need the same mechanism a single self-hosted deployment would use. The toggle itself (who may flip it, billing gates) is product concern — the framework only guarantees that an enabled-set is a first-class, checkable input to every derived surface."
acceptanceCriteria:
  - "defineApp accepts modules: named subsets of kinds/edges/mutations/invariants/lenses with declared inter-module dependencies"
  - "Store/provider accepts an enabled-module set; every derived surface (shelf, affordances, invariants, llms.txt, agent tools, check) respects it through existing seams, not per-surface filtering code"
  - "graview check gains module-closure findings (edge into disabled kind, mutation touching disabled kind, dependency not enabled)"
  - "Disabling with existing data hides via the horizon rather than deleting; re-enabling restores"
  - "The household example declares vehicles (and one more, e.g. meals) as modules and a toggled-off workspace renders coherently — harness-verified"
  - "The enabled set is plain serialisable config so a hosted platform can bind it to entitlements"
touches:
  - "64c337b0-f6a4-4f47-9826-3a36fccc8c27"
priority: "high"
source: "user request 2026-09-01: \"we might need the ability to have modules in a workspace turned on and off (like the Vehicles or meal planning within the household example, to keep it scoped) ... think about what might be good to bring into the graview framework to facilitate that (esp for graview-cloud)\""
---
