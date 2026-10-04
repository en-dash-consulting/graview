---
id: "7135b1fc-4a22-43c0-b09d-6aa5bb192c40"
level: "feature"
title: "A classic-worker build: the guest worker entry and a guest bundle need no module worker (FR-71)"
status: "pending"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-71"
  - "later"
  - "tier-2"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
acceptanceCriteria:
  - "@graview/guest's worker entry and a guest bundle built with the framework's tooling are classic scripts with no import or importScripts at run time"
  - "The bundle starts with new Worker(blobUrl) (no type: \"module\") under the spike's claude variant in Chromium, where module blob: workers fail"
description: "Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha."
lastModified: "2026-10-04T20:34:34.493Z"
---
