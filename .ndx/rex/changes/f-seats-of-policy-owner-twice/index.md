---
id: "0a50f2ff-1ddb-46c5-871d-3048e8792cff"
type: "change"
title: "A view's check as each seat names the owner once where the app's policy has an owner role"
slug: "f-seats-of-policy-owner-twice"
intent: "Graview Cloud's report (HQ feature:f-seats-of-policy-owner-twice): seatsOfPolicy of @graview/guest/headless returned the owner seat it was handed and a made-up view-as:owner seat for an app whose roles include \"owner\", which Cloud's default policy does, so the same seat was drawn twice. The owner seat it is handed is that role's seat."
acceptanceCriteria:
  - "seatsOfPolicy of a policy naming an owner role returns one owner seat, the principal it was handed, and no view-as:owner (test)"
tags:
  - "hq:feature:f-seats-of-policy-owner-twice"
  - "guest"
---
