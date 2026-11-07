---
id: "5c50fbcb-8294-4ba3-8ed2-c3e20ad0b002"
type: "change"
title: "Direct manipulation, corrected three ways: deeper into a group, only the drawn card is a target, a one-press act must be able to act"
slug: "direct-manipulation-corrected-three"
intent: "`withJackIn` in @graview/layout: a double-click on a record zooms, on a kind card on the ground zooms into its group as a place, on a district at altitude opens it in place — a kind card's own id was being made the focus, which no layout resolves, so the scene emptied. A view host is the layout's box and only its drawn content is now a hit target on the DOM path; the invisible remainder of a record read from altitude had swallowed a district's open button. The actions strip counted only required arguments as open, so an all-optional derived edit was a one-press button that refused \"Nothing to change\"; zero-open acts are rehearsed through the store's preview and a refusing one asks for its optional arguments, each skippable. Navigation, survey and menu harnesses cover all three."
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "scene"
  - "strip"
  - "hit-testing"
source: "claude-code session 2026-09-10"
---
