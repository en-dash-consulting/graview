---
id: "cdd910b9-7729-4f95-a821-3d59c35edb3b"
level: "feature"
title: "The declaration is a document: one JSON object compiles into the same app defineApp declares"
status: "pending"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-01"
blockedBy:
  - "3b647ea3-7070-40ee-b351-5115f42c5d3f"
source: "Graview Cloud FR-01, 2026-10-02"
acceptanceCriteria:
  - "compileDocument(doc) returns a GraviewApp that checkApp, createToolRuntime, deriveAffordances, the workbench and the pages face accept with no other code"
  - "graview check --document <file>, graview serve --document <file> and graview mcp --document <file> work without a TS entry"
  - "A compiled act is schema-checked, policy-checked, undoable and offered as a tool exactly like a defineMutation act"
  - "Parse and compile failures are check findings carrying a JSON path and a sentence"
  - "toDocument(apps/todo) round-trips to an app whose graview describe is identical, or names each surface it cannot express"
  - "Two documents equal in meaning canonicalise to the same bytes"
  - "Nothing in the document path evaluates strings as code (no eval, no Function), verified by a test that greps the module"
description: "WHAT IS THERE NOW: a declaration is a TS module carrying code in label/describe, Zod fields, mutation apply, invariant evaluate, migrations, views; loadApp import()s it; the studio's meta-graph snapshot is JSON and writtenBody synthesises create/connect/sever/write acts, but has no modules, sights, settings or rule judgements. MISSING: a document form a host can accept from a stranger and run without running their code. POSITION: @graview/core/document — the Graview Declaration Document (spec drafted at ../graview-cloud/docs/declaration-document.md): kinds with typed fields (string, text, number, integer, boolean, date, datetime, enum, list, url, email), label/describe templates with a closed formatter set, lifecycle, edges; acts as closed effects (create, set, connect, sever, remove) with shorthands, derived arguments and allowedWhen refusals; rules in the FR-07 language with repairs; policy, sees, modules, lenses, settings and brand as the data they already are (brand may be just an accent); migrations as ship steps only. parseDocument, compileDocument → GraviewApp, canonicalize + hash, toDocument(app) for a document-expressible TS app with a finding per surface that is not. The interim compiler in ../graview-cloud/packages/document is written on public APIs to be lifted here."
lastModified: "2026-10-02T20:55:20.128Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
