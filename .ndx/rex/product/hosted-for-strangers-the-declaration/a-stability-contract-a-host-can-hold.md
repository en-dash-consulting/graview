---
id: "83796ab4-ebd4-48f4-ad70-81121f49d17d"
type: "capability"
title: "A stability contract a host can hold the framework to: what a version may change, a changelog that says so, and capabilities() naming the seams it ships"
slug: "a-stability-contract-a-host-can-hold"
statement: "The framework publishes a stability contract that tells a host what each version may change across five surfaces, requires a Compatibility statement from changes that touch them, and exposes the seams a version ships through capabilities()."
criteria: [{"id":"c1","text":"When a changeset touches one of the five stability surfaces, the changeset shall carry a Compatibility line, and CI shall refuse one that does not."},{"id":"c2","text":"capabilities() shall list the FR ids shipped in this version and the protocol version."},{"id":"c3","text":"@graview/core shall export FRAMEWORK_VERSION, equal to the package version."},{"id":"c4","text":"If a rule throws, the framework shall yield a violation with status could-not-judge."}]
tags:
  - "graview-cloud"
  - "versions"
  - "FR-30"
source: "Nick, 2026-10-02: \"graview-cloud needs to have a foolproof strategy around core graview version increments\" — ../graview-cloud/docs/framework-versions.md"
priority: "critical"
---

WHAT IS THERE NOW: one fixed version for every @graview/* package, changesets, no written promise about what a minor may change. MISSING: a host running thousands of stored apps on one build needs to know, per version, whether stored data folds the same, whether a declaration that compiled still compiles, and whether derived tool schemas moved. POSITION: a written semver policy covering (1) ops and primitives — the stable contract, never changed incompatibly within a major; (2) snapshot and log formats — versioned (FR-31); (3) the WIRE and live protocols — additive within a major; (4) the declaration/document format and check finding codes — a code never changes meaning; (5) derived tool names and input schemas — a change is called out. The changelog gets a 'Compatibility' section per release. `capabilities()` returns { version, protocol, documentFormats, shipped: ['FR-01', …] } so a host can detect a seam instead of guessing.
