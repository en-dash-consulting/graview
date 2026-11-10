---
id: "71be9089-70bc-4d2d-adb3-f1bd728984d3"
type: "change"
title: "A guest frame that grows with its own height stops before the cap"
slug: "f-guest-growth-guard"
intent: "Cloud, 2026-11-10: Cloud lets a many-view frame grow to 20,000px; a page sized by 100vh grows with its frame until the cap. guestView does not expose onSize, so the host cannot guard it. Ask: a growth guard in the guest session, or onSize exposed."
acceptanceCriteria:
  - "A frame whose content height follows its own height stops growing after a few rounds and is said as such (test)"
  - "guestView exposes onSize to the host"
  - "A frame that grows for real (more content) still grows to the cap"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-guest-growth-guard"
source: "Graview HQ feature:f-guest-growth-guard"
---
