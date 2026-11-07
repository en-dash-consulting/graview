---
id: "c2f071fd-6a71-4677-b87a-9f7b3fd4f111"
type: "capability"
title: "An open page is told the app takes no changes for now, and when it does again (FR-66)"
slug: "an-open-page-is-told-the-app-takes-no"
statement: "When a host holds an app read-only, an open page is told that the app takes no changes for now, with a sentence, and is told when the app takes changes again."
criteria: [{"id":"c1","text":"When a host holds an app read-only, the host shall tell its sockets, and answer a since or state request, that the app is held, with a sentence, and shall tell them when the hold is released."},{"id":"c2","text":"When the host reports that the app is held or released, openRemote shall surface both the hold, with its sentence, and its release to the page."},{"id":"c3","text":"While the app is held, openRemote shall show a pending change as waiting on the hold, not on the network."}]
tags:
  - "graview-cloud"
  - "FR-66"
  - "now"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "high"
---

A host holding an app read-only (Cloud's quarantine while a repair is checked) answers every write unavailable (FR-46); openRemote keeps and retries the change but says nothing, so the person goes on typing into an app that keeps nothing. Ship's { t: "error", sentence } without reopen is the natural message, and openRemote ignores it.
