---
id: "cbfaf470-07b8-4d24-b1bf-c1127d2579d1"
type: "change"
title: "A removed record comes down on the one face on a slow machine too"
slug: "f-removed-record-comes-down-when-slow"
intent: "Found by PR #637's runs, 2026-11-16: one-face's aRemovedRecordComesDown fails on a GitHub runner under --slow 4 (run 43808997961), not investigated. Ask: find whether it is the harness or the face, and make it hold under --slow 4."
acceptanceCriteria:
  - "one-face's aRemovedRecordComesDown holds under GRAVIEW_SLOW=4 locally and on GitHub's runner (verify.yml), three runs in a row"
  - "The cause is named in the PR: harness timing or the face's own"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-removed-record-comes-down-when-slow"
source: "Graview HQ feature:f-removed-record-comes-down-when-slow"
---
