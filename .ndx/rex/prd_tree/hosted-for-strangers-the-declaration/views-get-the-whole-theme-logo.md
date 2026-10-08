---
id: "fa66a517-883c-4880-bcb3-397650473e0f"
level: "feature"
title: "Views get the whole theme, logo included (FR-127)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-127"
  - "chat-authored"
  - "tier-2"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
startedAt: "2026-10-07T18:51:54.000Z"
completedAt: "2026-10-07T18:51:54.000Z"
endedAt: "2026-10-07T18:51:54.000Z"
acceptanceCriteria:
  - "GuestTheme and the open kit's custom properties gain --graview-font-display, --graview-font-body, --graview-radius, the scheme and the logo"
  - "The host hands the view a blob: URL it made from the brand's logo (a same-origin asset reaches the view without the view loading anything) and the app's name"
  - "A worker view drawing <img src=\"${props.theme.logo}\"> and font-family: var(--graview-font-display) matches the app's wordmark and headings and follows a brand change without being redrawn"
description: "Views get colour tokens and fonts in GuestTheme but no logo, and can show images only as data:/blob: of the page's own."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #131 (0.1.16), with the logo fetched once by the host in #136: GuestTheme carries fontDisplay, radius, name and logo; a worker view is handed a blob: URL (data: where the page's policy refuses blob:), a frame guest data:, revoked when the next is handed and when the view goes."
---
