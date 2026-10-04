---
id: "2cc4d503-011c-498e-8982-0e04ece1946f"
level: "feature"
title: "The embed's stylesheet stays inside its box: every scoped themeCss rule is under the scope (FR-64)"
status: "completed"
startedAt: "2026-10-04T18:07:20.000Z"
completedAt: "2026-10-04T18:07:20.000Z"
endedAt: "2026-10-04T18:07:20.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-64"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.5)"
acceptanceCriteria:
  - "Every rule themeCss(scheme, brand, { scope }) emits is inside that scope, only :root motion and custom properties excepted, as documented"
  - "A test renders the embed beside a host <button>, <h2> and <code> and finds their computed styles unchanged by the embed"
  - "Cloud's scripts/a11y.mjs builder pages pass with its PAGE_GUARD (workers/cloud/src/builder.ts, INTERIM(FR-64)) deleted"
description: "A scoped themeCss still emits bare h1-h4, code/kbd/samp, button (hover, focus-visible, disabled) and code rules, so a host page that mounts the embed beside its own controls has them restyled; on Cloud's builder its buttons took the framework's ink and failed color-contrast in dark (3.41:1). A regression wherever an embed shares a page."
lastModified: "2026-10-04T18:07:20.000Z"
---
