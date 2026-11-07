---
id: "0b75e1d9-be44-4c90-8651-904b1b4422db"
type: "capability"
title: "A hardened guest worker runtime: every global outside an allowlist removed before guest code runs (FR-70)"
slug: "a-hardened-guest-worker-runtime-every"
statement: "The guest worker runtime removes every global outside an allowlist before guest code runs, so one view's worker cannot read what another view's worker stored, even where all widgets of an app share one origin."
criteria: [{"id":"c1","text":"Before guest code runs, the worker entry shall remove every global outside an allowlist (postMessage, timers, crypto.getRandomValues, structuredClone, the polyfilled DOM and the guest API), from every prototype on the global's chain."},{"id":"c2","text":"In Chromium and WebKit, the guest worker shall have fetch, XMLHttpRequest, WebSocket, EventSource, WebTransport, importScripts, indexedDB, caches, navigator.storage, BroadcastChannel, Worker and SharedWorker absent from its global, so that !(name in self) holds for each."}]
tags:
  - "graview-cloud"
  - "FR-70"
  - "later"
  - "tier-2"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "medium"
---

On ChatGPT every widget of an app shares one origin, so without this a second view's worker reads what the first stored: blocks Tier 2 release there. Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha.
