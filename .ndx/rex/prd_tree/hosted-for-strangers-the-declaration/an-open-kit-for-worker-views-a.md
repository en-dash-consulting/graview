---
id: "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
level: "feature"
title: "An open kit for worker views: a declared HTML/SVG/CSS allowlist, with everything that can fetch or escape removed (FR-90)"
status: "completed"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-90"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "A declared allowlist of HTML, SVG and CSS (per-element style and one stylesheet per view) with theme tokens as --graview-* custom properties following the app's toggle; rendered into a shadow root in a bounded region the host owns; Remote DOM's policy generated from the one allowlist"
  - "Everything that can fetch or escape is removed: url(), @import, @font-face, image-set(), external src/href/xlink:href, srcset, script, iframe, object, embed, link, meta, base, form submission, on* attributes, style outside the view's string, position: fixed or z-index escaping the region; images data:/blob: only"
  - "A worker view draws a styled card grid, an SVG bar chart and a CSS-animated progress ring matching the app in both schemes; an escape suite is each removed or refused, a test per case, in Chromium, WebKit and Firefox"
description: "Safety from what a view can reach, not what it can draw (ADR 0007). A worker guest draws only the eleven gv-* kit components today."
lastModified: "2026-10-06T03:56:09.000Z"
---
