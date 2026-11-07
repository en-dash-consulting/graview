---
id: "7135b1fc-4a22-43c0-b09d-6aa5bb192c40"
type: "capability"
title: "A classic-worker build: the guest worker entry and a guest bundle need no module worker (FR-71)"
slug: "a-classic-worker-build-the-guest"
statement: "The @graview/guest worker entry and a guest bundle built with the framework's tooling run as classic scripts, so they need no module worker, including inside chat widget sandboxes where module blob: workers fail."
criteria: [{"id":"c1","text":"The @graview/guest worker entry and a guest bundle built with the framework's tooling shall be classic scripts that use no import and no importScripts at run time."},{"id":"c2","text":"When run under the spike's claude variant in Chromium, where module blob: workers fail, the guest bundle shall start with new Worker(blobUrl) and no type: \"module\"."}]
tags:
  - "graview-cloud"
  - "FR-71"
  - "later"
  - "tier-2"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "low"
---

Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha.
