---
id: "c86f96dd-aaa8-4ae9-b7de-d32de3ec639e"
type: "change"
title: "Opening an app from the desk keeps the keyboard somewhere"
slug: "f-launcher-keeps-the-keyboard"
intent: "Found building the inbox (PR #537). In `apps/launcher`, pressing `launch-todo` removes the button and the keyboard lands on `<body>`. The watch's ledger holds it as `keyboard-lands-nowhere`."
acceptanceCriteria:
  - "Pressing a launch button on the desk puts the keyboard on the opened app (its first heading or main landmark)"
  - "A claim in verify-desk presses the button by keyboard and holds it, and the watch ledger says keyboard-lands-nowhere is fixed for the desk"
touches:
  - "ebbcef1a-944c-4534-a9ea-7a1a3f5c4251"
priority: "medium"
tags:
  - "graview"
  - "launcher"
  - "focus"
  - "hq:feature:f-launcher-keeps-the-keyboard"
source: "Graview HQ feature:f-launcher-keeps-the-keyboard"
---
