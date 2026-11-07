---
id: "16eb8833-8317-4acb-bad4-3ee5087520d4"
type: "capability"
title: "The companion is a top-level landmark or none, so axe's landmark-complementary-is-top-level holds (FR-40)"
slug: "the-companion-is-a-top-level-landmark"
statement: "The companion is exposed as a top-level complementary landmark or a labelled region, so the accessibility harness finds no framework node that breaks axe's landmark-complementary-is-top-level rule."
criteria: [{"id":"c1","text":"The companion shall be a top-level complementary landmark, or a labelled region."},{"id":"c2","text":"When the accessibility harness runs, it shall report zero framework nodes for landmark-complementary-is-top-level."}]
tags:
  - "graview-cloud"
  - "FR-40"
source: "Graview Cloud FR-40, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

aside[data-testid=companion] sits inside the workbench region; 24 nodes across Cloud's 12 templates.
