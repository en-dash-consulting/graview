---
id: "4e99104f-cc4b-4555-8ba1-2ff5524769ce"
type: "capability"
title: "Embed reports what went wrong and how long it took, without what was on screen"
slug: "embed-reports-what-went-wrong-and-how"
statement: "The embed mount lets a host observe failures and load speed through onError and onReady callbacks, with an error boundary per face, without exposing what was on screen."
criteria: [{"id":"c1","text":"When a view inside a face throws, the embed shall contain the error in that face's error boundary and report it to the host through onError."},{"id":"c2","text":"When a view inside a face throws, the embed shall keep the rest of the face usable."},{"id":"c3","text":"When the face first renders, the embed shall call onReady once with the time to first render in milliseconds ({ ms })."},{"id":"c4","text":"When the embed calls onError, it shall pass the error together with the module and face it came from, and only error classes and framework module names, never node values."}]
tags:
  - "graview-cloud"
  - "FR-13"
  - "operations"
source: "Graview Cloud docs/operations.md §1, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: an error inside a face is the browser's to report; a host learns nothing. MISSING: hosts observe failures and speed without reading content. POSITION: mount({ onError(error, { module, face }), onReady({ ms }) }) with an error boundary per face that keeps the rest usable; errors passed are classes and framework module names, never node values.
