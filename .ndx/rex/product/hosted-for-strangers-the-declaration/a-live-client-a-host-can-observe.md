---
id: "7475cb2d-a6dc-4bc6-81ef-41c1d0ccaff6"
type: "capability"
title: "A live client a host can observe: status, counters, pending, backoff, presence cadence and visibility (FR-49)"
slug: "a-live-client-a-host-can-observe"
statement: "A live client opened with openRemote lets a host observe its connection status, counters and pending changes, and tune its backoff, presence cadence and visibility."
criteria: [{"id":"c1","text":"openRemote shall offer onStatus, which reports the client's status as connecting, online or offline."},{"id":"c2","text":"openRemote shall offer counters(), which reports the number of reconnects, rebases and conflicts."},{"id":"c3","text":"openRemote shall offer pending(), which reports the changes still pending."},{"id":"c4","text":"openRemote shall accept options for backoff, presenceEveryMs and visible()."},{"id":"c5","text":"When an offline banner is driven by onStatus and shows the pending count read from pending(), the offline criterion shall pass against openRemote."}]
tags:
  - "graview-cloud"
  - "FR-49"
source: "Graview Cloud FR-49, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

The offline banner, Cloud's SLO beacons, and not broadcasting presence from background tabs.
