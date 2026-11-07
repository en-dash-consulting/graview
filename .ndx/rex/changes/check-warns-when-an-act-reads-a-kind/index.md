---
id: "c2fb79e5-d346-4584-9bb2-f886dff6f0e6"
type: "change"
title: "Check warns when an act reads a kind some role that may run it cannot see (FR-105)"
slug: "check-warns-when-an-act-reads-a-kind"
intent: "Cloud accepts 'an act's own logic can tell a seat whether a hidden record exists' as a documented limit for alpha; with chats writing acts, the author should be told. Raised in Cloud's brief after 0.1.10 (open questions)."
acceptanceCriteria:
  - "graview check flags an act whose preconditions or effects read a kind (or fields) that some role permitted to run the act cannot see, naming the act, the role and the kind"
  - "No runtime change"
touches:
  - "9135e25e-a3e4-4791-9f0a-88910f36884a"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-105"
  - "security"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
---
