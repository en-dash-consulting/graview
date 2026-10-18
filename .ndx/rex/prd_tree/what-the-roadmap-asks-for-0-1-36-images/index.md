---
id: "97f5a452-b235-4618-b5be-a4924a8c2b5e"
level: "epic"
title: "What the roadmap asks for 0.1.36: a view draws the pictures it was promised, and the navigation flake the second look recorded"
status: "completed"
completedAt: "2026-10-18T21:30:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "every task under this epic is completed or deferred with its reason written on its Roadmap item"
  - "each request is triaged to its layer; the framework half ships, and a Cloud half (if any) is a Roadmap feature with FRAMEWORK GIVES / CLOUD DOES / DONE WHEN"
description: "Two bug requests raised 2026-10-18 while building a photo gallery on Cloud (Maryland Family Weekend): pictures: true never delivers an image field's src to a view, and views refuse the app's own /graview/assets/ images that add_image stored. And the flake docs/flakes.json recorded on 0.1.35's branch Nightly: navigation's theMarkMovesAsTheSceneDoes."
lastModified: "2026-10-18T18:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [0.1.36 · A view with pictures: true gets each image field's src](./0-1-36-a-view-with-pictures-true-gets.md) | completed |
| [0.1.36 · A view draws the app's own /graview/assets/ images](./0-1-36-a-view-draws-the-apps-own.md) | completed |
| [0.1.36 · navigation's theMarkMovesAsTheSceneDoes judged at any frame rate](./0-1-36-navigations-mark-judged-at-any.md) | completed |
| [0.1.36 · A record's pictures and documents load where the host serves them, on every face](./0-1-36-a-records-files-load-under-the-apps.md) | completed |

## Notes

2026-10-18: done and published (0.1.36 on npm; #320, #321). Both view-picture requests were partly the framework's and partly what Cloud hands it; triage in Cloud's code (read-only) found the bigger bug under them: the face drew every record file from the workspace root under Cloud's /a/<app>/, so HostFiles.src and filesAt deriving it shipped as a fourth task. Writing Cloud's half found one more gap: Cloud hands files only to owners and editors, so f-take-0-1-36-cloud step 2 hands filesAt to every reader. The navigation flake is fixed by hearing the transition begin. Open: under GRAVIEW_SLOW=4 locally, navigation's aCardsChipsDoNotSilenceItsLines draws no week lines at all (not a timing race; CI has not met it).
