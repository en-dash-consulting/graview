---
id: "c2f071fd-6a71-4677-b87a-9f7b3fd4f111"
level: "feature"
title: "An open page is told the app takes no changes for now, and when it does again (FR-66)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-66"
  - "now"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
acceptanceCriteria:
  - "A host can tell its sockets, and a since/state answer, that the app is held, with a sentence, and when it is released"
  - "openRemote surfaces both (onHeld(sentence | null), or status() gaining \"held\")"
  - "A pending change shows as waiting on the hold, not on the network"
  - "Cloud's operator-quarantine test (packages/room/tests/operations.test.ts) reads it through openRemote with the shell's heldTap (INTERIM(FR-66)) deleted"
description: "A host holding an app read-only (Cloud's quarantine while a repair is checked) answers every write unavailable (FR-46); openRemote keeps and retries the change but says nothing, so the person goes on typing into an app that keeps nothing. Ship's { t: \"error\", sentence } without reopen is the natural message, and openRemote ignores it."
lastModified: "2026-10-04T20:34:34.493Z"
---
