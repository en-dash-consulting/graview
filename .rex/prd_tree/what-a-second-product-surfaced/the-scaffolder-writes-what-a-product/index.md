---
id: "6badabc4-8621-488c-99c6-c0d0e6706461"
level: "feature"
title: "The scaffolder writes what a product actually needs"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "graview create in an existing repository, with --link, yields a workspace whose first pnpm verify is clean with no warnings and no path into another repository's node_modules"
description: "F-001 through F-005 and F-011 are all graview create: it cannot start in a repository that already exists, it writes a layout no first-party product uses, its first build warns about the framework's own size, --no-install silently skips the skills, pnpm's build-script approval is an unexplained wall, and zod's types are pinned to a versioned path inside a sibling repository's pnpm store. All met before a line of domain is written."
lastModified: "2026-09-14T22:30:35.969Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [F-001 · graview create cannot start a product in a repository that already exists](./f-001-graview-create-cannot-start-a.md) | pending |
| [F-002 · The proven product layout is not the layout the scaffolder writes](./f-002-the-proven-product-layout-is-not.md) | pending |
| [F-003 · A fresh scaffold's first build prints a bundle-size warning](./f-003-a-fresh-scaffold-s-first-build.md) | pending |
| [F-004 · --no-install silently skips installing the skills](./f-004-no-install-silently-skips.md) | pending |
| [F-005 · pnpm's build-script approval is an unexplained wall on first install](./f-005-pnpm-s-build-script-approval-is.md) | pending |
| [F-011 · The scaffold pins zod's types to an exact path inside the framework's pnpm store](./f-011-the-scaffold-pins-zod-s-types-to.md) | pending |
