---
id: "1da2b382-3ea1-4290-9c81-117625945244"
level: "task"
title: "Every kind is a picture by default, and the scaffolder hands the face its views"
status: "pending"
priority: "high"
tags:
  - "pages"
  - "scaffold"
  - "create-graview"
acceptanceCriteria:
  - "Given views, the gallery lists every titled place first, then a card per live kind that has no titled place, drawn by `views.resolve(kind, many/full)` in fullscreen mode, titled by the plural, linking to the kind's list page"
  - "Given no views, the home still lands on the gallery grid: one card per kind with its count, description and first members — never the readme"
  - "packages/core/src/scaffold/ui.ts mainTsx passes `views: views()` and `settings` in the PagesApp context; scaffold.test.ts pins it; smoke-create still passes"
  - "A seedbed chapter with no lens (chapter nine) lands on a gallery of its four kinds"
description: "registerDefaultViews titles nothing, so a new app has no places and until now had no pictures on its pages face. The default group view is an honest picture of the pile — it is what the scene draws for the district — so it is what the card draws. The scaffold's Home surface wraps DefaultHomePage in Begin already; it only needed the views."
lastModified: "2026-09-27T06:00:50.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
