---
id: "fd5f906c-8413-4be3-9d4a-25666c33177b"
type: "capability"
title: "One guest client, served not copied: a prebuilt classic script and an authoring guide (FR-88)"
slug: "one-guest-client-served-not-copied-a"
statement: "Graview serves one prebuilt classic-script guest client and an authoring guide, so a frame guest connects, acts, navigates and resizes without copying the client into each view."
criteria: [{"id":"c1","text":"@graview/guest shall provide client.js as a prebuilt IIFE that exposes GraviewGuest.connect() and can be served at a fixed path or inlined."},{"id":"c2","text":"The authoring guide for a frame guest shall cover props (with FR-85/86), theme tokens, act, navigate, size and one worked example."},{"id":"c3","text":"When a guest view is a few lines of HTML plus the client script, it shall render, act, navigate and resize under Cloud's view CSP (script-src 'unsafe-inline' only)."}]
tags:
  - "graview-cloud"
  - "FR-88"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "low"
---

connectGuest is ESM-only, so every view inlines or bundles its own copy.
