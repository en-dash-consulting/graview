---
id: "bcd3f8a2-db89-46aa-b1d0-9965ea828ece"
level: "task"
title: "The page's chapters are live: one embed per chapter, a three-face toggle, the same seed the photograph used"
status: "pending"
priority: "high"
acceptanceCriteria: []
blockedBy:
  - "734b926b-c960-4419-8c49-259e958fb6b7"
description: "scripts/site-progression.mjs emits, per chapter, a mount point with the chapter's number and a face toggle (scene · graview · pages) instead of an <img>; a small bundle built by vite from apps/seedbed (chapters + embed entry) is inlined into docs/site/index.html by the site-artifact build and referenced as a file by the page's own copy. The chapter's seed, stop, principal and face come from chapters.ts, so the live view opens where the photograph was taken. The progression harness keeps taking the photographs for the record and CI; docs/progression.json keeps feeding the captions."
lastModified: "2026-09-09T19:45:04.424Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
