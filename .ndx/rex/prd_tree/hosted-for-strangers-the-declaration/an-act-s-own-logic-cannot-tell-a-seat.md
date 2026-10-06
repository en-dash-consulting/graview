---
id: "71f91552-5a08-409e-aa86-3be03f752808"
level: "feature"
title: "An act's own logic cannot tell a seat whether a hidden record exists"
status: "pending"
priority: "low"
tags:
  - "follow-up"
  - "security"
source: "The pre-0.1.4 audit of Graview Cloud, 2026-10-04"
acceptanceCriteria:
  - "An act whose body branches on whether a hidden record exists answers a seat that may not see it identically for a hidden record and an absent one"
  - "docs/stability.md §3 no longer lists it as a known limit"
description: "The framework closes every channel it owns (ids, labels in sentences, refusals, served logs), but an act runs on the full store, so an act body that refuses in its own words when a record is absent and differently when it is hidden can still be told apart. Options: run acts for a seat against its seat view, or judge an act refusal by what it read."
lastModified: "2026-10-04T05:39:56.000Z"
---
