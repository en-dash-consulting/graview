---
id: "42de4f53-b0e9-44bc-a525-27f848ecadc7"
level: "task"
title: "Pictures on pages: every place is a page, an index lands you among them, and the nav mirrors the scene's bar"
status: "in_progress"
priority: "high"
tags:
  - "pages"
  - "lenses"
startedAt: "2026-09-21T19:33:28.674Z"
acceptanceCriteria:
  - "PagesApp with `views` in context renders /places and /places/:as for every views.places() entry; without views the face is unchanged"
  - "The places index draws each lens small and live (inert), captioned with its kind; the lens page draws it full width in fullscreen mode with the kind's beginning acts beneath and a link to its scene stop"
  - "A pick inside a lens on a page navigates to that node's record"
  - "Nav order: places, then kinds, then Problems; home leads with the pictures; a kind page lists its own pictures"
  - "todo, seedbed and rota get all of it by passing their view registries; verify-pages.mjs checks the index, one lens page, the nav order, a pick's navigation, and phone width with no document side-scroll"
description: "PageContext gains `views` (the app's ViewRegistry) and `settings`/`presence` where the app has them; when views are given, PagesApp wraps its routes in a GraviewProvider (the embed already does this around the pages face, so lenses' hooks work with no scene). New routes: `/places` — the index: each registered place (views.places(): as, title, kind, across) as a card drawing the lens itself small and live (the drive-in board's thumbnail, inert, with `mode: \"fullscreen\"`), captioned \"a picture of <plural>\" and the kind's description; `/places/:as` — the lens full width in fullscreen mode over the kind's current members, the acts that begin the kind beneath it (kindFacts.actions as DerivedForms), and \"See it in the scene ↗\" (placeHref). Picks inside a lens on a page travel to the record (`recordPath`) instead of selecting. The shell's nav mirrors the scene's bar: the places as pills first, the kinds as the second row, Problems at the end; the home page leads with the pictures (the same cards) before the kind sections; each kind's list page opens with its own pictures (\"See <plural> as: The month · The week\") the way a district's board does. `graview check` refuses a place slug that collides with a kind's plural. Phone width: the index is one column; a lens page scrolls sideways inside its own region, never the document."
lastModified: "2026-09-21T19:33:28.685Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
