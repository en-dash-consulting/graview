---
id: "c38d36da-9afe-42a8-8bdc-0f3534a81955"
level: "task"
title: "0.1.36 · A view draws the app's own /graview/assets/ images"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "triaged: why /graview/assets/<id>, /a/<slug>/graview/assets/<id> and the app's full https URL are refused as Not drawn / host lists no origin, written on the request"
  - "an image the app holds (added with add_image) draws in that app's views in all three forms, with a test that fails on 0.1.35"
  - "the refusal text no longer promises what is refused; a Cloud half (e.g. add_image from the app's own /graview/files URL returning 401) is a Roadmap feature"
description: "Roadmap request:views-refuse-the-app-s-own-graview-assets-images-that-add-image-just-stored. The guide and the refusal both say a view may draw the app's own image (/graview/assets/…), yet every such img is refused."
completedAt: "2026-10-18T19:00:00.000Z"
endedAt: "2026-10-18T19:00:00.000Z"
lastModified: "2026-10-18T19:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Framework half on fix/views-draw-their-pictures: the app's own image is drawn by its path, under the base or by the page's address for it; runWorkerViewHeadless takes asset and origin; refusals offer only what the host draws. Cloud half: pass asset and origin to the headless run."
---

## Notes

**Triage: the refusals the reporter quoted were a headless run's (framework), with a seam Cloud
must fill; the other two forms were the judge (framework).**

- `Not drawn: …` is `sayRefusal`'s wording (`packages/guest/src/headless/judge.ts`): the
  reporter saw `propose_view`, which runs `runWorkerViewHeadless` (Cloud's
  `packages/room/src/room.ts` `tryWorkerView` and the describe beside it). The headless run had no
  `asset` option at all — `drawTranscript` judged with no resolver — so every `/graview/assets/`
  image was refused there, whatever the live page does. (Cloud's live page does pass
  `asset: (path) => base + path`.)
- `/a/<slug>/graview/assets/…` and the full `https://…` URL: the judge's `APP_IMAGE`
  (`packages/guest/src/host/open-judge.ts`) matched only `^/graview/assets/<sha256>.<ext>$`, and an
  https address only on a listed origin, so both were refused live and headless.
- The refusal (`imageRefusedWords`) always offered "the app's own image (/graview/assets/…)" and
  "an https: image on an origin the host lists", even on a host that draws neither.

**Decision.** `appImagePath` takes the path, that path under any base (a plain path on the page's
host, nothing climbing, no query) and the page's own origin's address for it, each as the one
canonical path handed to `asset`; another origin is refused. `runWorkerViewHeadless` takes
`asset` and `origin` (input `assets`, `origin`). `imageRefusedWords(address, { origins, assets })`
offers only what the host draws, names `asset` where it was not passed, and tells an app image on
another origin to be written as its path. `sayRefusal(refusal, host)` takes the same.

**Tests, failing first.** `packages/guest/tests/unit/a-view-draws-an-image-the-app-holds.test.ts`:
drawn by path, under the base and by full address on the page's origin (failed: three of four
null); refused on another origin, climbing, query (held already); the words offer only what is
drawn (failed); headless with `asset` and `origin` draws all three forms, without refuses each
naming `asset` (failed: three problems promising `/graview/assets/`). The https test's sentences
updated. `pnpm verify guest --quick`: 12 of 12 hold.

**Cloud half (Roadmap).** CLOUD DOES: in `packages/room/src/room.ts`, pass
`asset: (path) => appBase(slug) + path` and `origin: workspaceOrigin(env, workspaceSlug)` (and
`images` if the live page lists any) to both `runWorkerViewHeadless` calls. Separately, `add_image`
answering 401 for the app's own `/graview/files/…` https URL as a source is Cloud's connector
fetching its own host without the app's credentials: read the bytes from R2 (`files/<app>/<sha>`)
when the source is this app's file. DONE WHEN: `propose_view` on a view with
`<img src="/graview/assets/<sha>.webp">` reports no problem, and the live view draws it.
