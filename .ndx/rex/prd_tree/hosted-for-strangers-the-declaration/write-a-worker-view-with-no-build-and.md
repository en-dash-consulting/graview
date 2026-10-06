---
id: "d878bb20-a742-4dec-8731-35a3cb3d4168"
level: "feature"
title: "Write a worker view with no build and no copied protocol (FR-96)"
status: "completed"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-96"
  - "chat-authored"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "A worker view is one plain module against a host-provided global (graview.render, graview.props, graview.act, graview.navigate, graview.onProps) with no imports and no bundler"
  - "An authoring guide: the manifest, the allowlist, theme tokens, the write rules, two worked examples (a list lens and a home)"
  - "A chat writes a working view from the guide alone, in one message, with no tooling"
description: "lifelogics-graview/cloud-views/*.html are what a chat wrote instead, uploaded one by one from a laptop."
lastModified: "2026-10-06T03:56:09.000Z"
---
