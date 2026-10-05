---
id: "0b75e1d9-be44-4c90-8651-904b1b4422db"
level: "feature"
title: "A hardened guest worker runtime: every global outside an allowlist removed before guest code runs (FR-70)"
status: "completed"
startedAt: "2026-10-05T01:09:33.000Z"
completedAt: "2026-10-05T01:09:33.000Z"
endedAt: "2026-10-05T01:09:33.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-70"
  - "later"
  - "tier-2"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
acceptanceCriteria:
  - "Before guest code runs, the worker entry removes every global outside an allowlist (postMessage, timers, crypto.getRandomValues, structuredClone, the polyfilled DOM, the guest API), from every prototype on the global's chain"
  - "In Chromium and WebKit, inside the guest worker, fetch, XMLHttpRequest, WebSocket, EventSource, WebTransport, importScripts, indexedDB, caches, navigator.storage, BroadcastChannel, Worker and SharedWorker are absent (!(name in self))"
  - "A test enumerates the worker global and fails on any name outside the allowlist"
description: "On ChatGPT every widget of an app shares one origin, so without this a second view's worker reads what the first stored: blocks Tier 2 release there. Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha."
lastModified: "2026-10-05T01:09:33.000Z"
---
