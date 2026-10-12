---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view's delegated event is taught by the element it matched, and a DOM method the worker lacks says so. `graview.on(type, selector, listener)` always handed `event.element`, the element the selector matched at or above what was pressed, but nothing said it, and `event.target.closest(…)` failed with "closest is not a function" because Remote DOM's polyfill has none. Now `closest`, `matches` and `dataset` on a view's element throw "A view's element has no closest: graview.on hands event.element, the element its selector matched; read event.element.getAttribute("data-…")." The worker-view skill and the guest README show a delegated handler reading `event.element`'s `data-*`.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. What a view does: read `event.element.getAttribute("data-…")` rather than walking up from `event.target`.
