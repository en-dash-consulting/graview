---
id: "005d57d9-ae23-4155-81e8-af6c0f92c84a"
level: "feature"
title: "A conformance kit: fixtures any host runs against a version to prove it reads, compiles and derives the same"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "versions"
  - "FR-32"
source: "Graview Cloud docs/framework-versions.md, 2026-10-02"
startedAt: "2026-10-03T04:57:03.673Z"
completedAt: "2026-10-03T04:57:03.673Z"
endedAt: "2026-10-03T04:57:03.673Z"
acceptanceCriteria:
  - "The conformance runner passes on the version that ships it and lists differences on a deliberately broken build"
  - "Old fixtures are append-only; an intended difference is recorded with its version"
description: "WHAT IS THERE NOW: smoke-install proves a stranger can build with the tarballs; nothing proves a new version treats yesterday's stored data the same. MISSING: hosts each inventing their own golden sets. POSITION: @graview/core/conformance ships fixtures — declarations (TS and documents), op logs with their expected snapshot hashes (FR-20), expected tool schemas, expected check findings — and a runner `conformance(build)` returning differences by fixture id; each release adds fixtures and never edits old ones except to record an announced change."
lastModified: "2026-10-03T04:57:03.753Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
