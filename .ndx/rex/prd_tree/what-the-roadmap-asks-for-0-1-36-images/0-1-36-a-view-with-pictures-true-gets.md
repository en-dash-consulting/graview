---
id: "b70ed5cf-5c2b-4f84-8567-71c741c0eab6"
level: "task"
title: "0.1.36 · A view with pictures: true gets each image field's src"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "triaged: which layer drops src (the framework's guest/worker view host, or a host seam Cloud does not fill), written on the request"
  - "a view with pictures: true reading a record whose image field holds { href: /graview/files/…, name, type, bytes } receives src and draws it, with a test that fails on 0.1.35"
  - "if a host must hand something, the framework says so in place (refusal or console line) rather than silently dropping src, and the Cloud half is a Roadmap feature"
description: "Roadmap request:pictures-true-never-delivers-src-views-get-image-fields-without-the-picture. A view with pictures: true gets each image field as { name, type, bytes }; src never arrives in propose_view runs or the live page, though the authoring guide says it arrives once it has come."
completedAt: "2026-10-18T19:00:00.000Z"
endedAt: "2026-10-18T19:00:00.000Z"
lastModified: "2026-10-18T19:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Framework half on fix/views-draw-their-pictures: a host says where a record's files are (file on the view's definition), a picture not loaded says what the host answered and names file, a headless run hands a stand-in src. Cloud half: pass file: (href) => base + href."
---

## Notes

**Triage: two layers.**

- **Live page — framework, with a seam Cloud must fill.** `createGuestPictures`'s fetch
  (`packages/guest/src/host/pictures.ts`, `make`: `new URL(file.href, document.baseURI)`) resolved a
  record's `/graview/files/<sha>.<ext>` against the page. Cloud serves an app at
  `https://<workspace>.graview.app/a/<app>/` (ADR 0008) and its records keep the base-less path
  (`workers/cloud/src/files.ts` `filePath`), served only at `/a/<app>/graview/files/…`
  (`routes/app.ts`). So the fetch reached the workspace's root, which is no app (401 / a page), and
  the picture was left out with a bare "could not be loaded" — never `src`. The framework had no way
  for a host to say where a record's files are (it has `asset` for `/graview/assets/`, nothing for
  files).
- **propose_view — framework.** `runWorkerViewHeadless` (`packages/guest/src/headless/index.ts`)
  handed each picture `guestFileOf(file)` with no `src` by design, so a view that draws
  `photo.src` drew nothing in Cloud's preview (the reporter's `Object.keys` printed
  `name,type,bytes`).

**Decision.** `file?: (href) => string | undefined` on `WorkerViewDefinition`, `mountWorkerView`,
`mountGuestView` and `guestView` (as `asset` is): where the page fetches a record's file; without
it, where it did before. A picture the host did not answer for says what it answered (the status,
or the type it sent) and, where `file` was not given, names it — in `left`, the view's console and
`onProblem` — never the path. A headless run hands each picture `src: PICTURE_STAND_IN` (a blank
GIF), so the view's `<img>` is drawn and judged. Skill `graview-view-drawing` and the guest README
say both.

**Tests, failing first.** `packages/guest/tests/unit/a-view-with-pictures-gets-each-image-fields-src.test.ts`:
handed src under a base via `file` (failed: src undefined); without `file`, says "the host answered
401" and names `file` (failed: bare sentence); headless hands the stand-in and draws the `<img>`
(failed: no picture drawn). `a-guest-view-is-handed-the-pictures-it-may-show.test.ts`'s exact
sentence updated. Harness `guest-sandbox --transport=pictures` gained a base scenario (the page at
`/a/jobs/`, `file: (href) => "/a/jobs" + href`): 16 of 16 claims hold in Chromium, WebKit and
Firefox; with `file` dropped, "under a base, the host fetched each picture where it said a record's
files are, under /a/jobs" and "under a base, nothing was asked of /graview/files/ at the host's
root" fail. `pnpm verify guest --quick`: 12 of 12 runs hold.

**Cloud half (Roadmap).** CLOUD DOES: in `packages/client/src/shell.ts`, add
`file: (href: string) => base + href` to each worker view's definition beside
`asset: (path) => base + path` (and to `guestView` options for a frame that asks for pictures).
DONE WHEN: on `https://<workspace>.graview.app/a/<app>/` a view with `pictures: true` over a record
whose `photo` holds `/graview/files/<sha>.webp` draws it. Likely the same root cause, unverified:
the framework's own face draws a record's picture as `<img src={file.href}>`
(`packages/primitives/src/files.tsx`), which under `/a/<app>/` also resolves to the workspace's root.
