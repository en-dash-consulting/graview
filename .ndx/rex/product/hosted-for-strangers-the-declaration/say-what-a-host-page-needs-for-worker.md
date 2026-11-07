---
id: "7ebface6-a29e-4e0f-a1b9-bc2f32557c1d"
type: "capability"
title: "Say what a host page needs for worker views, and say when it is missing (FR-102)"
slug: "say-what-a-host-page-needs-for-worker"
statement: "A Graview host page is told what policy an open-kit worker view needs, and a worker that fails to start is reported with its own onFailure reason rather than a silent plain face."
criteria: [{"id":"c1","text":"The guest README's host section shall list the page policy an open-kit view needs, namely worker-src blob:, or the alternative if a host serves the runtime itself."},{"id":"c2","text":"If a worker fails to start, the guest host shall report it through onFailure with its own reason, start."},{"id":"c3","text":"When a page has no worker-src, the guest host shall report the start failure once rather than drawing a silent plain face."}]
tags:
  - "graview-cloud"
  - "FR-102"
  - "tier-2"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "medium"
---

Cloud's page had no worker-src, the browser fell back to script-src and refused the blob worker; every view drew its plain face with no clue why.
