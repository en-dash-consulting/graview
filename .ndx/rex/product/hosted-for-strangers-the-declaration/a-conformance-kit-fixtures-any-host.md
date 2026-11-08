---
id: "005d57d9-ae23-4155-81e8-af6c0f92c84a"
type: "capability"
title: "A conformance kit: fixtures any host runs against a version to prove it reads, compiles and derives the same"
slug: "a-conformance-kit-fixtures-any-host"
statement: "The conformance kit in @graview/core/conformance ships fixtures — declarations, op logs with their expected snapshot hashes, expected tool schemas and expected check findings — and a runner, conformance(build), that returns the differences between a build and those fixtures by fixture id."
criteria: [{"id":"c1","text":"When conformance(build) runs against the version that ships it, the runner shall report no differences."},{"id":"c2","text":"When conformance(build) runs against a deliberately broken build, the runner shall list the differences by fixture id."},{"id":"c3","text":"The conformance kit shall keep old fixtures unchanged when a release adds new fixtures."},{"id":"c4","text":"When a fixture's expected result changes intentionally, the conformance kit shall record the difference together with the version that announced it."}]
tags:
  - "graview-cloud"
  - "versions"
  - "FR-32"
source: "Graview Cloud docs/framework-versions.md, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: smoke-install proves a stranger can build with the tarballs; nothing proves a new version treats yesterday's stored data the same. MISSING: hosts each inventing their own golden sets. POSITION: @graview/core/conformance ships fixtures — declarations (TS and documents), op logs with their expected snapshot hashes (FR-20), expected tool schemas, expected check findings — and a runner `conformance(build)` returning differences by fixture id; each release adds fixtures and never edits old ones except to record an announced change.
