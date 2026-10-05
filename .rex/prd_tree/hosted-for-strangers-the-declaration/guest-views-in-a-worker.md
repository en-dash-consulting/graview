---
id: "9d0b7c79-6e44-4b96-8db4-6576c56de0d3"
level: "feature"
title: "Guest views in a worker: @graview/guest's worker entry and a host that takes a worker source (FR-68)"
status: "completed"
startedAt: "2026-10-05T01:09:33.000Z"
completedAt: "2026-10-05T01:09:33.000Z"
endedAt: "2026-10-05T01:09:33.000Z"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-68"
  - "later"
  - "tier-2"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
acceptanceCriteria:
  - "@graview/guest offers a worker entry that boots the Remote DOM polyfill and exposes the guest API (props in, act, navigate, resize); the host side accepts a worker source as well as a frame URL"
  - "A guest bundle built against the worker entry, started from a blob: URL under the spike's claude and chatgpt policies, renders, receives sight-filtered props, and has an act it requests applied under the viewer's principal with via: view:<name> and the existing rate limits"
  - "The frame guest's suite passes for the worker guest, in Chromium and WebKit"
description: "The FR-04 guest-view protocol over a worker as well as a frame. Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha."
lastModified: "2026-10-05T01:09:33.000Z"
---
