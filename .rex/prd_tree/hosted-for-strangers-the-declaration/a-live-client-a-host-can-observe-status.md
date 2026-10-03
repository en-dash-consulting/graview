---
id: "7475cb2d-a6dc-4bc6-81ef-41c1d0ccaff6"
level: "feature"
title: "A live client a host can observe: status, counters, pending, backoff, presence cadence and visibility (FR-49)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-49"
source: "Graview Cloud FR-49, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "openRemote offers onStatus(connecting | online | offline), counters() (reconnects, rebases, conflicts) and pending()"
  - "Options for backoff, presenceEveryMs and visible()"
  - "An offline criterion passes against openRemote with the banner driven by onStatus and the pending count read from pending()"
description: "The offline banner, Cloud's SLO beacons, and not broadcasting presence from background tabs."
lastModified: "2026-10-03T17:32:15.000Z"
---
