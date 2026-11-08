---
id: "5b40f827-46a6-4842-bcc6-a67a0deabd2b"
type: "capability"
title: "A guest view gets the theme, and follows the app's toggle (FR-86)"
slug: "a-guest-view-gets-the-theme-and"
statement: "A guest view receives the app's theme in its props, drawn from the brand and the embed's current scheme, and follows the app's light/dark toggle."
criteria: [{"id":"c1","text":"The host shall pass each guest view a props.theme object carrying scheme, accent, ground, panel, ink, inkMuted, edge, fontBody and fontMono, taken from the brand and the embed's current scheme."},{"id":"c2","text":"When the app's scheme is toggled, the host shall push the updated props.theme to the guest view again."},{"id":"c3","text":"While a guest view draws from props.theme, it shall match the app in both light and dark."},{"id":"c4","text":"When the app's toggle sets a scheme that differs from prefers-color-scheme, the guest view shall follow the app's toggle."}]
tags:
  - "graview-cloud"
  - "FR-86"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "low"
---

No guest prop or message carries the theme. For owner-uploaded frames; the worker form is FR-91.
