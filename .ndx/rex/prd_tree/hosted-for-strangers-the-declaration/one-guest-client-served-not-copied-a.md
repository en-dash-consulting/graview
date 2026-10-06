---
id: "fd5f906c-8413-4be3-9d4a-25666c33177b"
level: "feature"
title: "One guest client, served not copied: a prebuilt classic script and an authoring guide (FR-88)"
status: "completed"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-88"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "@graview/guest/client.js is a prebuilt IIFE exposing GraviewGuest.connect(), servable at a fixed path or inlined"
  - "An authoring guide for a frame guest: props (with FR-85/86), theme tokens, act, navigate, size, one worked example"
  - "A few lines of HTML plus that script renders, acts, navigates and resizes under Cloud's view CSP (script-src 'unsafe-inline' only)"
description: "connectGuest is ESM-only, so every view inlines or bundles its own copy."
lastModified: "2026-10-06T03:56:09.000Z"
---
