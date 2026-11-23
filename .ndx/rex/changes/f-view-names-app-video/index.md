---
id: "9d61af23-db75-42cf-ac7c-f8764e1a1dda"
type: "change"
title: "A view can play an app-level video (the app's reel), not only a record's"
slug: "f-view-names-app-video"
intent: "From HQ feature:f-view-names-app-video: Cloud keeps an app-level reel (the share video; describe_app's reel). <graview-video> plays only a file on a record the view was shown, and a bare <video> is never drawn. Ask: a way for a view to name an app-level video, e.g. <graview-video data-app=\"reel\">, with its facts in props.theme.reel."
acceptanceCriteria:
  - "A view's <graview-video data-app=\"reel\"> plays the reel the host handed (test)"
  - "The reel's facts reach the view in props.theme.reel (test)"
  - "With no reel handed, the element draws nothing and the host says why (test)"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-view-names-app-video"
source: "Graview HQ feature:f-view-names-app-video"
---
