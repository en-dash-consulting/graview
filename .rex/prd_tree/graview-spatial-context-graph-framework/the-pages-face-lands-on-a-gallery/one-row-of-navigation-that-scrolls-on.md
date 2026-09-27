---
id: "e30d9a92-e897-465a-bea2-5d69e795c6b0"
level: "task"
title: "One row of navigation that scrolls on a phone, and a picture's page offers its siblings"
status: "completed"
priority: "medium"
startedAt: "2026-09-27T06:05:00.000Z"
completedAt: "2026-09-27T07:05:00.000Z"
endedAt: "2026-09-27T07:05:00.000Z"
resolutionType: "code-change"
resolutionDetail: "DefaultShell: one nav (aria-label Pages, data-testid shell-nav) — Pictures/Home, kinds, Map, Problems — overflow-x auto; header and footer at 1160. DefaultPlacePage carries a sibling-pictures strip; /places renders the gallery. theNavIsOneRow holds at 1280 and 390 with no document side-scroll."
tags:
  - "pages"
  - "design"
  - "mobile"
acceptanceCriteria:
  - "DefaultShell renders one nav row: a first tab for the home (\"Pictures\" when the face has any, \"Home\" otherwise, current on / and /places*), the kinds, Map when relations exist, Problems with its count last; the pictures are no longer their own row"
  - "At 390px the row scrolls horizontally inside itself (overflow-x auto, no wrap) and the document does not scroll sideways — verify-pages' hygiene checks pass on the seedbed default face"
  - "DefaultPlacePage shows a strip of the other pictures (`data-testid=\"sibling-pictures\"`) under its header, each a link by title; /places renders the same gallery as the home"
description: "The scene's bar went to one row (45c7a2c); the pages shell still had two, three on a phone. With the gallery as the home, a pictures row in the nav duplicated the page under it."
lastModified: "2026-09-27T07:05:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
