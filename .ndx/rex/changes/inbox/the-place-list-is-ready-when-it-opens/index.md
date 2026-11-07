---
id: "3b107d80-3292-47f0-a05a-3bba70d5a0d7"
type: "change"
title: "The place list is ready when it opens (FR-140)"
slug: "the-place-list-is-ready-when-it-opens"
intent: "From the scene, pressing Pages, opening the place list and choosing an entry within 100-300 ms is dropped: the address stays / though aria-pressed and app-place-current already show."
acceptanceCriteria:
  - "A pick made the moment the list is open goes to that place, however soon after pressing Pages; or the bar marks itself aria-busy until it is ready"
  - "A script that presses Pages, opens the list and picks an entry with no pause lands on that place, 20 times out of 20"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-140"
  - "bug"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (brief after 0.1.17)"
resolution: "Shipped in #151 (0.1.18): the routed face hands the bar its way of going once it is on the page, and a place asked for before then waits for it; pnpm verify quiet lands 20 picks of 20 with no pause in three engines."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The scene and the pages are two things, and the bar says so (FR-137)" (0e34e849-8b72-4900-8e4a-37f12b3aa79e).
