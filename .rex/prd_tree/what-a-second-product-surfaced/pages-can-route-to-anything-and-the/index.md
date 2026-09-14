---
id: "63bcc889-264e-4b44-bc30-5d1e0ed7300b"
level: "feature"
title: "Pages can route to anything, and the shell passes the responder through"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/pages"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "An app adds a route to PagesApp with one registry call"
  - "An app passes its responder to Shell with one prop"
description: "Two seams that exist and cannot be reached: PagesApp derives its routes and lets an app replace but not add one, so an onboarding, settings or import page has nowhere to live; Shell has a chat panel and no prop to hand it the app's domain responder."
lastModified: "2026-09-14T22:30:33.283Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [F-021 · Shell gives the Responder seam no hole to come through](./f-021-shell-gives-the-responder-seam.md) | pending |
| [F-025 · PagesApp has no slot for a page that is not about a kind](./f-025-pagesapp-has-no-slot-for-a-page.md) | pending |
