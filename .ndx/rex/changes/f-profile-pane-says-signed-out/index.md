---
id: "a9ef46f8-4cea-46a4-9289-340e92a772b0"
type: "change"
title: "The account pane says a visitor is not signed in, and offers the host's sign-in first"
slug: "f-profile-pane-says-signed-out"
intent: "With `signIn` handed by the host (the visitor mark since FR-183, 0.1.34), ProfilePane still heads its top part \"Signed in as\" followed by the principal's name (\"A visitor\" on Cloud), and the roles line reads \"No role in particular\". A visitor reads that as being signed in as someone anonymous with no way out; on a custom home view with no struck act nothing else offers sign-in. Asked (Cloud brief b-cloud-2026-11-08-visitor-sign-in): when `signIn` is present, the pane says the person is not signed in, its first row is `signIn.label` running `signIn.run()`, drawn the way the menu's sign-in button is, and the \"Signed in as\" and role lines are left off. Cloud drops its own \"Sign in\" host action once the pane offers it."
acceptanceCriteria:
  - "With signIn handed, ProfilePane says the person is not signed in and draws no \"Signed in as\" line and no role line (unit test)"
  - "With signIn handed, the pane's first control is signIn.label and pressing it runs signIn.run() (unit test)"
  - "Without signIn, the pane is unchanged: \"Signed in as\" with the name and the role line (unit test)"
  - "A harness that opens the profile pane as a visitor holds the claim in a real browser, and the keyboard lands on the sign-in control"
touches:
  - "d6e98c63-c1ae-40dc-82bc-5eee85bab996"
priority: "high"
tags:
  - "graview"
  - "primitives"
  - "profile"
  - "hq:feature:f-profile-pane-says-signed-out"
source: "Graview HQ feature:f-profile-pane-says-signed-out, from brief:b-cloud-2026-11-08-visitor-sign-in"
---
