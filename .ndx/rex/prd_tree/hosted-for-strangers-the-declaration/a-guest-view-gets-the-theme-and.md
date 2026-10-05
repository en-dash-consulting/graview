---
id: "5b40f827-46a6-4842-bcc6-a67a0deabd2b"
level: "feature"
title: "A guest view gets the theme, and follows the app's toggle (FR-86)"
status: "pending"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-86"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "Props carry theme { scheme, accent, ground, panel, ink, inkMuted, edge, fontBody, fontMono } from the brand and the embed's current scheme, pushed again on toggle"
  - "A guest drawing from props.theme matches the app in light and dark and follows the app's toggle even against prefers-color-scheme"
description: "No guest prop or message carries the theme. For owner-uploaded frames; the worker form is FR-91."
lastModified: "2026-10-05T20:03:32.950Z"
---
