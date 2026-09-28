---
id: "1e155ee2-de1c-41fd-bfe4-ddaf98a8fdbe"
level: "feature"
title: "The pages face lands on a gallery: every picture large and live, every kind a picture by default, and the reading matter on its own pages"
status: "completed"
priority: "high"
tags:
  - "pages"
  - "lenses"
  - "design"
  - "scaffold"
source: "Nick, 2026-09-27: \"make the default Pages setup be more enticing and attractive. by default the landing page for pages should show a gallery-type view of the lenses, and then maybe that stuff under, or that stuff under lands on a different page. right now the landing feels like a boring readme. a beautiful Pages UI should come shipped ootb for all graview apps.\""
startedAt: "2026-09-27T06:00:50.000Z"
completedAt: "2026-09-27T07:05:00.000Z"
endedAt: "2026-09-27T07:05:00.000Z"
resolutionType: "code-change"
resolutionDetail: "The derived home is a gallery: the standing as headline, every titled lens as a large live card, a contact-sheet card for every kind without one, one row of kind counts, a line to /map, Recently. One-row shell nav that scrolls on a phone; sibling strip on a picture page; /places is the gallery. Scaffold passes views and settings. verify-pages theLandingIsAGallery and theNavIsOneRow hold; 1442 tests pass; typecheck clean; skill, chapter nine and site regenerated; changeset written."
acceptanceCriteria:
  - "The derived home is a gallery: the app's pictures as large live cards in a wide grid (two across at a desk, one on a phone), each captioned with its name and how much it is over, before anything else on the page — measured in a browser by verify-pages, not asserted"
  - "An empty picture is not a blank frame: the card says there is nothing in it yet and names the act that would begin it, when the seat may take it"
  - "Every kind is a picture by default: a live kind with no titled lens gets a card drawn by its resolved many/full view, titled by its plural and opening its list, so a `graview create` app lands on a gallery on its first afternoon; titling a lens replaces the kind's default card"
  - "The scaffolder hands PagesApp the app's views and settings, so a new project's pages face has its pictures, its map and its assistant without editing main.tsx"
  - "The reading matter leaves the home: the relations live at /map (linked from the home in one line), the kinds are one compact row of counts under the gallery, and Recently stays short at the foot"
  - "The shell's navigation is one row — pictures (home), the kinds, Map, Problems — that scrolls sideways on a phone rather than wrapping to three rows; a picture's page offers its sibling pictures so a reader can hop between them"
  - "Unit tests that pinned the readme shape are rewritten for the gallery shape; the graview-pages skill, chapter nine's claim and the docs site say what now comes for free; every package touched carries a changeset"
description: "The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, two 288-pixel picture cards a third of the way down a 760-pixel column, then the relations list and one section per kind with its description and four members. The pictures — the one thing on the face that is the app's own — were the smallest thing on the page, and an app with no titled lens (chapter nine of seedbed; every app `graview create` writes, since `registerDefaultViews` titles nothing and the scaffold's main.tsx hands PagesApp no views at all) had no pictures on the home whatsoever.\n\nThe redesign makes the landing the gallery. A wide column (1160) for the shell and the home while the reading pages keep their 760 measure; the standing sentence as the h1 (\"2 gardeners, 2 plots, 1 planting and 1 rule.\" — the numbers are the headline, honestly); then the pictures as large cards, each the lens itself drawn live and inert at the card's own measured scale, captioned with its title and what it is over; then one compact row of the kinds with counts, a one-line way to the map, and Recently. A kind without a titled lens is drawn by its default group view so no app lands on an empty gallery; a picture with nothing in it says so and names the beginning act rather than showing a blank frame. The shell drops its second navigation row: the pictures are the home, the kinds and Map and Problems are the row, and it scrolls on a phone. A picture's page carries a strip of its siblings.\n\nThe earlier feature (9e265cbb) claimed \"an index lands you among them\"; the index existed at /places but the home did not land you among anything, which is the criterion this feature reopens."
lastModified: "2026-09-27T07:05:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [The home is a gallery: the pictures large and live in a wide grid, the standing as the headline, an empty picture says what would fill it, and the reading matter moves to /map and a row of counts](./the-home-is-a-gallery-the-pictures.md) | completed |
| [Every kind is a picture by default, and the scaffolder hands the face its views](./every-kind-is-a-picture-by-default.md) | completed |
| [One row of navigation that scrolls on a phone, and a picture's page offers its siblings](./one-row-of-navigation-that-scrolls-on.md) | completed |
| [The harness measures the gallery, and the skill, the chapter and the site say what comes for free](./the-harness-measures-the-gallery-and.md) | completed |
| [A new page opens at its top: the routed face resets the scroll on a new address, and leaves Back to the browser](./a-new-page-opens-at-its-top.md) | completed |

## Log

- 2026-09-27 — Captured from conversation. Rex's MCP endpoint answered 409 (this project is not among the ones registered on the running `ndx start`), so the item was written straight into the tree in rex's own shape.
- 2026-09-27 — Done. Decisions: the h1 is the standing sentence rather than the brand name (the masthead already says it); default kind cards are a contact sheet of summary views rather than the framework's group panel, which sat as six chips in the corner of a frame; the gallery claim is measured on chapter sixteen because the default seedbed registers only two titled lenses; the previous feature's record is left completed with a log entry rather than flipped. Rex MCP still 409 at the end, so the tree was edited by hand throughout.
- 2026-09-27 — Nick: "scroll reset in Pages views isn't working". The face had never reset the scroll; the gallery exposed it. Fixed as a fifth task under this feature.
