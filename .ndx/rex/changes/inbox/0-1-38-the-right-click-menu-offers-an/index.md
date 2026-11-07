---
id: "9b7fe67a-056f-47b5-b359-6e3e6c632bab"
type: "change"
title: "0.1.38 · The right-click menu offers an existing view or lens before drawing a new one"
slug: "0-1-38-the-right-click-menu-offers-an"
intent: "Roadmap f-menu-suggests-existing-views (from r-menu-suggests-existing-views, Nick 2026-10-19)."
acceptanceCriteria:
  - "where the menu offers to draw a view, it first matches the app's views and lenses (title, attachment, what they read) to the target and the ask and offers Open <view> (Open and adjust for a partial fit) above Draw a new view"
  - "at most three suggestions, none and no header when nothing fits, no model call (manifests only), from the menu's prefetch and cache; the menu is no taller than today"
  - "tests fail first; asking the Recon-like fixture for a searchable board offers the existing board first"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
resolution: "On feat/menu-suggests-existing-views: existingViewsOf (@graview/core/catalog) matches the app's places by what they attach to, read, are titled and are, with no model call; the menu offers the best one above Draw a new view, in a row its suggestions give up; the quick ask offers up to three for its words; Open and adjust opens the view with the quick ask on it. Place carries lens and reads, a worker view its manifest's reads."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The seat draws a view on the fly, and keeps it as a lens" (e7d433e2-8130-44d8-a327-c325ace39937).
