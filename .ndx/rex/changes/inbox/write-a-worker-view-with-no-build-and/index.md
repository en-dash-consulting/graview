---
id: "d878bb20-a742-4dec-8731-35a3cb3d4168"
type: "change"
title: "Write a worker view with no build and no copied protocol (FR-96)"
slug: "write-a-worker-view-with-no-build-and"
intent: "lifelogics-graview/cloud-views/*.html are what a chat wrote instead, uploaded one by one from a laptop."
acceptanceCriteria:
  - "A worker view is one plain module against a host-provided global (graview.render, graview.props, graview.act, graview.navigate, graview.onProps) with no imports and no bundler"
  - "An authoring guide: the manifest, the allowlist, theme tokens, the write rules, two worked examples (a list lens and a home)"
  - "A chat writes a working view from the guide alone, in one message, with no tooling"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-96"
  - "chat-authored"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "An open kit for worker views: a declared HTML/SVG/CSS allowlist, with everything that can fetch or escape removed (FR-90)" (5fd9c76f-1dc7-477f-8e1a-4130f74102df).
