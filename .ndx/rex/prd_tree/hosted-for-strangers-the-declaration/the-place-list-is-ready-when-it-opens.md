---
id: "3b107d80-3292-47f0-a05a-3bba70d5a0d7"
level: "feature"
title: "The place list is ready when it opens (FR-140)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-140"
  - "bug"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (brief after 0.1.17)"
acceptanceCriteria:
  - "A pick made the moment the list is open goes to that place, however soon after pressing Pages; or the bar marks itself aria-busy until it is ready"
  - "A script that presses Pages, opens the list and picks an entry with no pause lands on that place, 20 times out of 20"
description: "From the scene, pressing Pages, opening the place list and choosing an entry within 100-300 ms is dropped: the address stays / though aria-pressed and app-place-current already show."
lastModified: "2026-10-08T18:31:13.493Z"
---
