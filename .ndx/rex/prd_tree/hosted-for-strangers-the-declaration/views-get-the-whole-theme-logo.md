---
id: "fa66a517-883c-4880-bcb3-397650473e0f"
level: "feature"
title: "Views get the whole theme, logo included (FR-127)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-127"
  - "chat-authored"
  - "tier-2"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
acceptanceCriteria:
  - "GuestTheme and the open kit's custom properties gain --graview-font-display, --graview-font-body, --graview-radius, the scheme and the logo"
  - "The host hands the view a blob: URL it made from the brand's logo (a same-origin asset reaches the view without the view loading anything) and the app's name"
  - "A worker view drawing <img src=\"${props.theme.logo}\"> and font-family: var(--graview-font-display) matches the app's wordmark and headings and follows a brand change without being redrawn"
description: "Views get colour tokens and fonts in GuestTheme but no logo, and can show images only as data:/blob: of the page's own."
lastModified: "2026-10-07T17:42:39.129Z"
---
