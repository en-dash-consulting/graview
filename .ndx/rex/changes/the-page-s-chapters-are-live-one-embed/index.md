---
id: "bcd3f8a2-db89-46aa-b1d0-9965ea828ece"
type: "change"
title: "The page's chapters are live: one embed per chapter, a three-face toggle, the same seed the photograph used"
slug: "the-page-s-chapters-are-live-one-embed"
intent: "scripts/site-progression.mjs emits, per chapter, a mount point with the chapter's number and a face toggle (scene · graview · pages) instead of an <img>; a small bundle built by vite from apps/seedbed (chapters + embed entry) is inlined into docs/site/index.html by the site-artifact build and referenced as a file by the page's own copy. The chapter's seed, stop, principal and face come from chapters.ts, so the live view opens where the photograph was taken. The progression harness keeps taking the photographs for the record and CI; docs/progression.json keeps feeding the captions."
touches:
  - "f59ea8e1-68bf-4320-b226-96db703ab81b"
priority: "high"
blockedBy:
  - "734b926b-c960-4419-8c49-259e958fb6b7"
---
