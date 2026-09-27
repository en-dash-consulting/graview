---
id: "e342631a-663d-46bd-8b56-c0f5e2ac344c"
level: "task"
title: "The harness measures the gallery, and the skill, the chapter and the site say what comes for free"
status: "completed"
priority: "medium"
startedAt: "2026-09-27T06:05:00.000Z"
completedAt: "2026-09-27T07:05:00.000Z"
endedAt: "2026-09-27T07:05:00.000Z"
resolutionType: "code-change"
resolutionDetail: "verify-pages gains theLandingIsAGallery (chapter 16 at 1280/390, chapter 9 for default cards) and theNavIsOneRow, both holding in docs/pages-face.json. graview-pages SKILL.md rewritten under its 11000-character budget, copies current; chapter nine claim updated; site rebuilt; one changeset for pages, core and skills."
tags:
  - "pages"
  - "harness"
  - "docs"
  - "skills"
blockedBy:
  - "6c8f85ad-be5a-445b-bcc8-0f73530ac49b"
  - "1da2b382-3ea1-4290-9c81-117625945244"
  - "e30d9a92-e897-465a-bea2-5d69e795c6b0"
acceptanceCriteria:
  - "verify-pages.mjs gains `theLandingIsAGallery` on seedbed's default face: the gallery is the first section after the header, cards are at least 420px wide at 1280 and two share a row, one column at 390, every card's frame has something drawn in it; and `theNavIsOneRow`: every nav link shares one top at 1280; both written to docs/pages-face.json"
  - "graview-pages SKILL.md's \"What comes for free\" describes the gallery landing, the default kind cards and the one-row nav; `pnpm skills` copies are current"
  - "Chapter nine's claim mentions the gallery; `pnpm site:build:all` regenerated; tests/site.test.ts passes"
  - "Changesets for @graview/pages, @graview/core and @graview/skills, patch, in the voice of the existing ones"
description: "A verdict is a file: the claim that failed is named in docs/pages-face.json rather than summarised from a log."
lastModified: "2026-09-27T07:05:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
