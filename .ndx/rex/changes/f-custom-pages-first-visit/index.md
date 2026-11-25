---
id: "1c0f176f-70db-434c-9009-e084e75430c6"
type: "change"
title: "A first visit to a custom page shows no blank place: its code and the reader's kept values are fetched ahead"
slug: "f-custom-pages-first-visit"
intent: "From HQ feature:f-custom-pages-first-visit: The rest of f-custom-pages-do-not-flash. A first visit stands blank about 150-250 ms, waiting for the view's code and the host's viewerState.read. Fetch ahead as the pointer or keyboard reaches a link, ask viewerState once and share it, and consider holding the page being left for a short bounded time."
acceptanceCriteria:
  - "First visits are timed before and after in three engines, with no blank frame where the code had been fetched ahead (harness claim)"
  - "A failing view still falls back within its budget (test)"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "pages"
  - "react"
  - "hq:feature:f-custom-pages-first-visit"
source: "Graview HQ feature:f-custom-pages-first-visit"
---
