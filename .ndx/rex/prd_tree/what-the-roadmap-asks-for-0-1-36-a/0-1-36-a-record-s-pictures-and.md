---
id: "dd4ba5b7-009d-424d-99af-89fe785dc927"
level: "task"
title: "0.1.36 · A record's pictures and documents load where the host serves them, on every face"
status: "completed"
priority: "critical"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "HostFiles carries a resolver (src(href)) that every place the framework draws or links a record's file goes through: thumbnails, image blocks, galleries, document links and downloads, on the scene and Pages"
  - "filesAt(url) derives it from its own url, so a host that hands filesAt(base + '/graview/files') gets pictures under its base with no other change; a test fails on 0.1.35"
  - "a worker or guest view the framework mounts takes file from it unless told otherwise"
description: "Found while triaging the 0.1.36 view-picture bugs: Graview Cloud serves an app's files only at /a/<app>/graview/files/… and records keep /graview/files/… without the base, so packages/primitives/src/files.tsx's <img src={file.href}> asks the workspace root. Cloud's own face thumbnails and galleries are likely not loading."
completedAt: "2026-10-18T20:30:00.000Z"
endedAt: "2026-10-18T20:30:00.000Z"
lastModified: "2026-10-18T20:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Framework half on fix/files-load-under-the-hosts-base: HostFiles.src and fileSrc route every drawn, linked and downloaded file; filesAt derives src from its url; framework-mounted worker and frame views default file to it. Cloud half: none beyond the bump, since it already hands filesAt(base + '/graview/files')."
---

## Notes

**Triage: framework.** Every place the framework draws a record's file goes through one part,
`packages/primitives/src/files.tsx` (fetched by `files-door.tsx`): the card thumbnail
(`default-views.tsx`), a spec view's image block (`spec-views.tsx`), the record's fields
(`editable.tsx`) on the scene and on Pages, and the editor's previews after an upload. Each drew
`file.href` as it is. Pages' static render draws no record's file; a guest view's pictures already
took `file` (8536e92f).

**Decision.**
- `HostFiles.src?(href): string` (`packages/core/src/schema/files.ts`), and
  `fileSrc(files, href)` on `@graview/core`'s main entry, the href where the host says nothing.
  `files.tsx` draws, links and downloads through it: thumbnail, gallery picture, full size,
  inline PDF, its fallback download, the document link. `data-graview-thumb`,
  `data-graview-full`, `data-graview-removed-later`, React keys and `kept` (and its per-href
  cache) still use the stored href, so no harness changed what it reads.
- `filesAt(url)` answers `src`: an href starting `/graview/files/` is drawn at
  `url` (trailing slash dropped) + the rest; any other href (the dev door's
  `/__graview/files/…`, which already is where it is served) is left as it is.
- `workerView`'s mount and `guestView`'s frame mount default their `file` to the page's
  `files.src` (read through a ref, so a host that makes `files` anew each render does not remount
  the view); a definition's own `file` wins. The guest packages read `src` directly rather than
  importing `fileSrc`, to keep the guest host's first load small; it still grew 166 / 69 and
  191 / 67 bytes, raised in two files in `scripts/budget-raises/`.

**Tests (each failed before the change):**
`packages/ship/tests/unit/files-at-says-where-a-records-file-is-served.test.ts`,
`packages/primitives/tests/unit/a-records-picture-loads-where-the-host-serves-it.test.tsx`,
`packages/pages/tests/unit/a-records-picture-loads-under-the-hosts-base.test.tsx` (Pages,
handed only `filesAt("/a/jobs/graview/files")`, as Cloud does),
`packages/guest/tests/unit/a-view-the-framework-mounts-fetches-files-where-the-host-serves-them.test.tsx`.
The guest pictures suite (`guest`, `--transport=pictures`) gained a third scenario: under
`/a/jobs/` with `files: filesAt(base + "/graview/files")` and no `file` on the view — the view's
pictures and the porch's own record page (its gallery and its quote's download) load under the
base, nothing asked of the root.

**Cloud.** Nothing beyond the bump: it already hands ``filesAt(`${base}/graview/files`, …)``, and
the Pages test above is that exact handoff. It may drop any `file` it passes on a view definition.

