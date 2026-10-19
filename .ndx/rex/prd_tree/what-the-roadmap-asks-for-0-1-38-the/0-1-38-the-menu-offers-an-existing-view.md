---
id: "9b7fe67a-056f-47b5-b359-6e3e6c632bab"
level: "task"
title: "0.1.38 · The right-click menu offers an existing view or lens before drawing a new one"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "where the menu offers to draw a view, it first matches the app's views and lenses (title, attachment, what they read) to the target and the ask and offers Open <view> (Open and adjust for a partial fit) above Draw a new view"
  - "at most three suggestions, none and no header when nothing fits, no model call (manifests only), from the menu's prefetch and cache; the menu is no taller than today"
  - "tests fail first; asking the Recon-like fixture for a searchable board offers the existing board first"
description: "Roadmap f-menu-suggests-existing-views (from r-menu-suggests-existing-views, Nick 2026-10-19)."
lastModified: "2026-10-19T04:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
