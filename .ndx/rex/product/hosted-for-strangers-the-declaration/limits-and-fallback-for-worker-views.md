---
id: "1cccd24b-2ecb-4ffe-858b-377eed4693c6"
type: "capability"
title: "Limits and fallback for worker views: bytes, nodes, messages and CPU per push (FR-94)"
slug: "limits-and-fallback-for-worker-views"
statement: "The host stops a worker view that exceeds its limits on source bytes, rendered nodes, messages per second or CPU time per props push, draws the kind's Tier 1 face in its place, and reports the reason through onFailure."
criteria: [{"id":"c1","text":"The host shall cap the source bytes of a worker view."},{"id":"c2","text":"The host shall cap the number of nodes a worker view renders."},{"id":"c3","text":"The host shall cap the number of messages per second a worker view sends."},{"id":"c4","text":"The host shall cap the CPU time a worker view spends on each props push."},{"id":"c5","text":"If a worker view exceeds any of the source byte, rendered node, message rate or per-push CPU limits, the host shall stop the worker, draw the kind's Tier 1 face, and report the reason via onFailure."},{"id":"c6","text":"If a worker view spins, floods messages or renders 100k nodes, the host shall stop it within the budget, show the Tier 1 face, and report the reason."}]
tags:
  - "graview-cloud"
  - "FR-94"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

Extends 0.1.8's watchdog and acts/maxNodes limits.
