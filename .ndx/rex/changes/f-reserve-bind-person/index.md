---
id: "b5da5ab7-1b70-41ab-8c4f-bd1daf4d3017"
type: "change"
title: "bind-person is reserved: a document cannot shadow the framework's act"
slug: "f-reserve-bind-person"
intent: "Found by Cloud's invite-as build on 0.1.73: compileDocument accepts a document act named bind-person, and store.js installs the binder only if no mutation of that name exists, so bindPerson runs the document's act. Reserve the name in the compiler and have bindPerson call its own act whatever a document declares."
acceptanceCriteria:
  - "compileDocument refuses an act named bind-person with a finding (test)"
  - "bindPerson binds through the framework's act even against a store whose declaration names one (test)"
touches:
  - "369257a0-22a8-471f-85dd-eee0e8bfcf78"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-reserve-bind-person"
source: "Graview HQ feature:f-reserve-bind-person"
---
