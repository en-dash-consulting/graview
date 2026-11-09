---
id: "db001777-1283-4eb0-b091-8d06f3f4405c"
type: "change"
title: "A far step asks the host before saying an app has no such act, so a host can refuse in its own words"
slug: "f-far-app-host-refusal"
intent: "Found building Cloud's FarApps. When `FarApp.shape.acts` lacks the act, a workflow run skips the step with \"<app> has no act “x”\" before calling `act`, so a host that wants to deny an app cannot word its own refusal (\"the owner of this workflow's app may not change that app\"). Asked: a way for `otherApp` to answer `{ refused: sentence }`, or call `act` and let the host refuse, so the run says the host's words."
acceptanceCriteria:
  - "A host's otherApp may answer { refused: sentence }, and the run's step says that sentence (test)"
  - "A far act missing from the shape is still said in words when the host gives no refusal of its own (test)"
  - "The workflows skill and the FarApp type say how a host refuses"
touches:
  - "ebbcef1a-944c-4534-a9ea-7a1a3f5c4251"
priority: "medium"
tags:
  - "graview"
  - "tools"
  - "workflows"
  - "hq:feature:f-far-app-host-refusal"
source: "Graview HQ feature:f-far-app-host-refusal"
---
