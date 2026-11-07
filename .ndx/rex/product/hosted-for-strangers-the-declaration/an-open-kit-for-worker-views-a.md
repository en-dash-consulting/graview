---
id: "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
type: "capability"
title: "An open kit for worker views: a declared HTML/SVG/CSS allowlist, with everything that can fetch or escape removed (FR-90)"
slug: "an-open-kit-for-worker-views-a"
statement: "A worker view draws with a declared allowlist of HTML, SVG and CSS inside a bounded region the host owns, and everything in a view that can fetch or escape that region is removed."
criteria: [{"id":"c1","text":"The host shall render a worker view's HTML, SVG and CSS from one declared allowlist, with per-element style and one stylesheet per view, into a shadow root in a bounded region the host owns."},{"id":"c2","text":"The host shall expose theme tokens to a worker view as --graview-* custom properties that follow the app's toggle."},{"id":"c3","text":"The host shall generate Remote DOM's policy from the one declared allowlist."},{"id":"c4","text":"The host shall remove url(), @import, @font-face and image-set() from a worker view's CSS."},{"id":"c5","text":"The host shall remove external src, href and xlink:href values and srcset from a worker view."},{"id":"c6","text":"The host shall remove script, iframe, object, embed, link, meta and base elements from a worker view."},{"id":"c7","text":"The host shall refuse form submission and remove on* attributes from a worker view."},{"id":"c8","text":"The host shall apply style only from the view's own string, and shall not let position: fixed or z-index escape the view's region."},{"id":"c9","text":"The host shall allow images in a worker view only from data: or blob: sources."},{"id":"c10","text":"A worker view shall be able to draw a styled card grid, an SVG bar chart and a CSS-animated progress ring that match the app in both schemes."},{"id":"c11","text":"Each removed or refused construct shall have its own escape test, run in Chromium, WebKit and Firefox."}]
tags:
  - "graview-cloud"
  - "FR-90"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

Safety from what a view can reach, not what it can draw (ADR 0007). A worker guest draws only the eleven gv-* kit components today.
