---
id: "1bc667e8-7632-4cfa-bc0f-0a22fe08ef3e"
level: "task"
title: "F-032 · PagesApp's test router drops the basename, so a doubled link passes every test"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/pages"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "MemoryRouter receives basename and initialPath is prefixed with it, so a test renders the hrefs a browser will"
  - "A test renders a Link to=\"/x\" under basename=/pages in memory mode and asserts href=/pages/x"
  - "graview-pages says every `to` on the routed face is basename-relative"
description: "With initialPath, PagesApp renders <MemoryRouter initialEntries={[initialPath]}> and drops basename; without it, <BrowserRouter basename>. A <Link to=\"/pages/survey\"> under basename=/pages renders href=/pages/survey in tests and /pages/pages/survey in a browser. Groundskeeper shipped nine such links and a helper building them; 25 design tests asserting exact hrefs were green throughout."
lastModified: "2026-09-15T04:34:14.440Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
