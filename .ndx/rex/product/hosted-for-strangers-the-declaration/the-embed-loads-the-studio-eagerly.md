---
id: "8dfa18c2-fbf4-460f-8c8e-7143e60bd789"
type: "capability"
title: "The embed loads the studio eagerly when the studio is the whole page (FR-63)"
slug: "the-embed-loads-the-studio-eagerly"
statement: "The embed loads the studio eagerly when the studio is the whole page, so the studio draws without a round trip for a lazy chunk."
criteria: [{"id":"c1","text":"When a host calls mount with studio options that set eager: true, the embed shall put no @graview/studio module in a lazy chunk of the bundle that mounts it."},{"id":"c2","text":"When a host uses the studio overlay exported on its own, the embed shall put no @graview/studio module in a lazy chunk of the bundle that mounts it."}]
tags:
  - "graview-cloud"
  - "FR-63"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "low"
---

Cloud's /apps/:id/builder pays a round trip for a 109 KB chunk before the studio draws.
