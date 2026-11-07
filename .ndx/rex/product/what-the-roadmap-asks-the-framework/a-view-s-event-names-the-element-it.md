---
id: "a8590a47-99ba-47f3-80db-5cda29eed0f6"
type: "capability"
title: "A view's event names the element it matched, and a missing DOM method says so"
slug: "a-view-s-event-names-the-element-it"
statement: "A view's event handler learns which element its selector matched through event.element, and a DOM method the worker's polyfill lacks fails with a sentence that points to event.element."
criteria: [{"id":"c1","text":"The worker-view skill shall show a delegated handler reading event.element's data-* attributes."},{"id":"c2","text":"The guest README shall show a delegated handler reading event.element's data-* attributes."},{"id":"c3","text":"When a worker view calls a DOM method that the worker's polyfill lacks (closest, matches or querySelector on an event target), the polyfill shall throw an error whose message is a sentence naming event.element as the way to reach the matched element."}]
tags:
  - "roadmap"
  - "f-view-event-data-framework"
source: "Graview Roadmap: f-view-event-data-framework"
priority: "high"
resolution: "Shipped in #233: the worker-view skill and the guest README teach event.element's data-*, and closest, matches and dataset on a view's element throw a sentence naming event.element."
---

graview.on(type, selector, listener) already hands { element } (the element the selector matched), but nothing teaches it, and event.target.closest() in a worker fails with an opaque error because the Remote DOM polyfill lacks it.
