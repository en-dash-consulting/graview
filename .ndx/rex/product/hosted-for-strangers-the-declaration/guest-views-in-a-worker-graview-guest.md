---
id: "9d0b7c79-6e44-4b96-8db4-6576c56de0d3"
type: "capability"
title: "Guest views in a worker: @graview/guest's worker entry and a host that takes a worker source (FR-68)"
slug: "guest-views-in-a-worker-graview-guest"
statement: "Graview serves the guest-view protocol over a worker as well as over a frame, so a guest view can run in a blob: worker inside a chat widget sandbox."
criteria: [{"id":"c1","text":"@graview/guest shall offer a worker entry that boots the Remote DOM polyfill and exposes the guest API (props in, act, navigate, resize)."},{"id":"c2","text":"The guest host shall accept a worker source as well as a frame URL."},{"id":"c3","text":"When a guest bundle built against the worker entry is started from a blob: URL under the claude and chatgpt policies, the guest shall render and receive sight-filtered props."},{"id":"c4","text":"When a worker guest requests an act, the host shall apply it under the viewer's principal with via: view:<name> and the existing rate limits."},{"id":"c5","text":"The worker guest shall pass the frame guest's suite in Chromium and WebKit."}]
tags:
  - "graview-cloud"
  - "FR-68"
  - "later"
  - "tier-2"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "low"
---

The FR-04 guest-view protocol over a worker as well as a frame. Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha.
