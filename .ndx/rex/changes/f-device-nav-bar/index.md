---
id: "af0aedd8-054b-4999-9345-72d3a86a744f"
type: "change"
title: "An app declares which places a device offers as screens"
slug: "f-device-nav-bar"
intent: "Cloud, 2026-11-11 (accepted by Nick): a declaration section naming device screens in order with short labels, drawn by the e-ink render as a bottom strip plus Refresh, and in the tap map as go regions. When an app declares none it falls back to the app's jobs, else its bar."
acceptanceCriteria:
  - "A declaration's device screens are drawn in order as a bottom strip with Refresh, each a go region in the tap map, the current one marked (test)"
  - "graview check refuses a screen naming a place the app does not have, a label too long for the strip, and more screens than the strip holds, each in words with the fix (test)"
  - "An app that declares no screens gets them from its jobs, else from its bar (test)"
  - "The studio and the edits can add, reorder and remove a screen (test)"
touches:
  - "dd8e4788-2c4f-435c-91d6-b7c2c32ab5df"
  - "1612641e-295e-4f0b-ab74-3c011d2e0dee"
priority: "high"
tags:
  - "graview"
  - "core"
  - "pages"
  - "hq:feature:f-device-nav-bar"
source: "Graview HQ feature:f-device-nav-bar"
---
