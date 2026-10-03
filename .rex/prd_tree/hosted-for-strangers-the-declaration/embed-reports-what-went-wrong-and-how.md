---
id: "4e99104f-cc4b-4555-8ba1-2ff5524769ce"
level: "feature"
title: "Embed reports what went wrong and how long it took, without what was on screen"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-13"
  - "operations"
source: "Graview Cloud docs/operations.md §1, 2026-10-02"
acceptanceCriteria:
  - "A view that throws is contained and reported through onError; the rest of the face keeps working"
  - "onReady fires once with time to first render"
description: "WHAT IS THERE NOW: an error inside a face is the browser's to report; a host learns nothing. MISSING: hosts observe failures and speed without reading content. POSITION: mount({ onError(error, { module, face }), onReady({ ms }) }) with an error boundary per face that keeps the rest usable; errors passed are classes and framework module names, never node values."
lastModified: "2026-10-02T22:46:26.091Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
