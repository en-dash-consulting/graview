---
id: "8eed578e-cdaa-4724-8a61-022f34cf780c"
level: "task"
title: "The watch hears a page whose module rejected before it drew"
status: "completed"
startedAt: "2026-10-20T08:40:00.000Z"
completedAt: "2026-10-20T09:30:00.000Z"
endedAt: "2026-10-20T09:30:00.000Z"
priority: "medium"
tags:
  - "engines"
source: "ndx-capture"
acceptanceCriteria:
  - "the watch reports a page whose app root drew nothing after load, or whose module rejected, in all three engines"
  - "a watch test fails first"
description: "Found fixing the Nightly's engines leg (#330): in WebKit the page's top-level await rejected with no pageerror, and the watch passed a blank page"
lastModified: "2026-10-20T09:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
