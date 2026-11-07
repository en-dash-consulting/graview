---
id: "71f91552-5a08-409e-aa86-3be03f752808"
type: "change"
title: "An act's own logic cannot tell a seat whether a hidden record exists"
slug: "an-act-s-own-logic-cannot-tell-a-seat"
intent: "The framework closes every channel it owns (ids, labels in sentences, refusals, served logs), but an act runs on the full store, so an act body that refuses in its own words when a record is absent and differently when it is hidden can still be told apart. Options: run acts for a seat against its seat view, or judge an act refusal by what it read."
acceptanceCriteria:
  - "An act whose body branches on whether a hidden record exists answers a seat that may not see it identically for a hidden record and an absent one"
  - "docs/stability.md §3 no longer lists it as a known limit"
priority: "low"
tags:
  - "follow-up"
  - "security"
source: "The pre-0.1.4 audit of Graview Cloud, 2026-10-04"
resolution: "Fixed in #214: an act runs under its caller's sight — its body, condition, refusal and sentence read the seat's view, and its writes land on the whole store."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "An id a seat asks for or is minted, and a single-source link it sets, tell it nothing of a hidden record" (9135e25e-a3e4-4791-9f0a-88910f36884a).
