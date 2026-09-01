---
id: "68b2b2e0-2aa9-489a-9dba-83be3975ba99"
level: "epic"
title: "Distribution: something people can install, extend and trust"
status: "completed"
priority: "high"
tags:
  - "release"
  - "dx"
source: "Session: skills package, changesets, GitHub CI to npm"
startedAt: "2026-08-31T03:42:03.600Z"
completedAt: "2026-09-01T07:18:44.649Z"
endedAt: "2026-09-01T07:18:44.649Z"
acceptanceCriteria:
  - "A person can npm install a Graview package and build an app from the published artefacts alone"
  - "Versioning and publishing are automated and boring"
  - "The public surface is a deliberate decision, written down, not whatever happened to be exported"
  - "An assistant helping someone build on Graview has skills that teach the authoring moves and end in a check"
description: "Six packages, every one `private: true`, no licence, no `files`, no changesets and no CI. Nothing here has ever been installed by anyone, which means every claim about the public API is currently untested by the only test that matters.\n\nTwo halves: getting the packages out (versioning, licensing, publishing, and deciding what is actually public) and giving people something to build WITH once they have them."
---

## Children

| Title | Status |
|-------|--------|
| [A skills package for building with Graview](./a-skills-package-for-building-3e30b3.md) | completed |
| [Deployment is a framework concern: the ship subpackage](./deployment-is-a-framework-bb2b2a.md) | completed |
| [Releases: changesets, CI, npm](./releases-changesets-ci-npm.md) | completed |
