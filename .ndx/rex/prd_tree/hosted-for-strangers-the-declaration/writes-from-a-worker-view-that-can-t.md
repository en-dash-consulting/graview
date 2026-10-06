---
id: "3ec6e21f-a966-4621-925f-587e2a14a876"
level: "feature"
title: "Writes from a worker view that can't leak: manifest acts, and presses the host saw (FR-92)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-92"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
acceptanceCriteria:
  - "An act must be named in the manifest; with total sight (derived from the policy) it applies as given; otherwise only from a press the host saw on an element the view drew, in that handler, with arguments only from the bound record (data-record), manifest constants and input values the host read; attributed via view:<name>, rate-limited, undoable"
  - "With sights on, a view reading a hidden field and calling act with it (no press; a press with a computed argument; an input it filled itself) is refused each time; a press on a bound button with a typed value applies; with sights off a declared act applies from code"
description: "A view that can read hidden data must not be able to write it anywhere."
lastModified: "2026-10-06T03:56:09.000Z"
---
