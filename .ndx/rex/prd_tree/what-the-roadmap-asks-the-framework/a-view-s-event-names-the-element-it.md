---
id: "a8590a47-99ba-47f3-80db-5cda29eed0f6"
level: "feature"
title: "A view's event names the element it matched, and a missing DOM method says so"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-view-event-data-framework"
source: "Graview Roadmap: f-view-event-data-framework"
startedAt: "2026-10-12T14:12:00.000Z"
completedAt: "2026-10-12T14:40:00.000Z"
endedAt: "2026-10-12T14:40:00.000Z"
acceptanceCriteria:
  - "The worker-view skill and the guest README show a delegated handler reading event.element's data-*"
  - "Calling a DOM method the worker's polyfill lacks (closest, matches, querySelector on a target) throws a sentence naming event.element as the way"
  - "A test holds both"
description: "graview.on(type, selector, listener) already hands { element } (the element the selector matched), but nothing teaches it, and event.target.closest() in a worker fails with an opaque error because the Remote DOM polyfill lacks it."
resolution: "Shipped in #233: the worker-view skill and the guest README teach event.element's data-*, and closest, matches and dataset on a view's element throw a sentence naming event.element."
lastModified: "2026-10-12T14:40:00.000Z"
---
