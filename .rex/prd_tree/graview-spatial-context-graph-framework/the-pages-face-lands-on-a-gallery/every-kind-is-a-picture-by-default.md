---
id: "1da2b382-3ea1-4290-9c81-117625945244"
level: "task"
title: "Every kind is a picture by default, and the scaffolder hands the face its views"
status: "completed"
priority: "high"
startedAt: "2026-09-27T06:05:00.000Z"
completedAt: "2026-09-27T07:05:00.000Z"
endedAt: "2026-09-27T07:05:00.000Z"
resolutionType: "code-change"
resolutionDetail: "galleryOf lists titled places then a card per live kind without one; KindOnPage draws an app-written group view as-is, replaces the framework default with a contact sheet of one/summary views, and falls back to label chips with no registry. Scaffold main.tsx passes views() and settings; scaffold.test pins it. verify-pages chapterNine: 0 place cards, 4 kind cards, every frame drawn."
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
lastModified: "2026-09-27T07:05:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
