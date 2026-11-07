---
id: "2cc4d503-011c-498e-8982-0e04ece1946f"
type: "capability"
title: "The embed's stylesheet stays inside its box: every scoped themeCss rule is under the scope (FR-64)"
slug: "the-embed-s-stylesheet-stays-inside"
statement: "The embed's stylesheet keeps every rule inside its scope, so a host page that mounts the embed beside its own controls keeps their styles unchanged."
criteria: [{"id":"c1","text":"When themeCss(scheme, brand, { scope }) is called with a scope, the embed's stylesheet shall emit every rule inside that scope, excepting only :root motion and custom properties."},{"id":"c2","text":"When an embed is rendered beside a host <button>, <h2> and <code>, the embed's stylesheet shall leave the computed styles of those host elements unchanged."},{"id":"c3","text":"While an embed shares a page with Cloud's builder, the builder pages shall pass the scripts/a11y.mjs checks without the PAGE_GUARD in workers/cloud/src/builder.ts."}]
tags:
  - "graview-cloud"
  - "FR-64"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.5)"
priority: "high"
---

A scoped themeCss still emits bare h1-h4, code/kbd/samp, button (hover, focus-visible, disabled) and code rules, so a host page that mounts the embed beside its own controls has them restyled; on Cloud's builder its buttons took the framework's ink and failed color-contrast in dark (3.41:1). A regression wherever an embed shares a page.
