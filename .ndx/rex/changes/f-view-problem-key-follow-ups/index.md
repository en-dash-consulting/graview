---
id: "05b01731-021b-435a-a64a-583f9320ef9b"
type: "change"
title: "A view problem's key is used wherever problems are compared, and a template's view check refuses the same far kind"
slug: "f-view-problem-key-follow-ups"
intent: "From HQ feature:f-view-problem-key-follow-ups (left by PR #657): (1) viewProblemKey in packages/core/src/revisions/problems.ts keys problems by sentence; prefer the problem's key when it has one. (2) The template view check in packages/core/src/document/graview-template.ts does not apply checkProposedManifest's refusal of a far kind missing from reads.kinds."
acceptanceCriteria:
  - "Problems with a key are compared by key, so a reworded sentence is the same problem (test)"
  - "A template's view that reads a far kind missing from reads.kinds is refused as checkProposedManifest refuses it (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "guest"
  - "hq:feature:f-view-problem-key-follow-ups"
source: "Graview HQ feature:f-view-problem-key-follow-ups"
---
