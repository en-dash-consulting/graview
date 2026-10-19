---
id: "87e317b2-65f4-462d-a09b-dedb1f1d1a66"
level: "task"
title: "0.1.38 · Right-click a place to hide, delete and restore a view"
status: "completed"
startedAt: "2026-10-19T04:40:00.000Z"
completedAt: "2026-10-19T07:30:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "the current place in the bar and each places drop-down entry open the Pages menu (right-click, Shift+F10, long press) with Hide and Delete for a view"
  - "Hide is app-wide: out of the drop-down and the Scene, listed under Hidden at the drop-down's foot with Show; for a declared lens it is set-lens-hidden"
  - "Delete lists the view under Recently deleted for 30 days with Restore, through a host seam (the host keeps deleted views as it keeps view versions); a declared lens's delete is a document change with its rollback"
  - "tests fail first; a view is hidden, shown, deleted and restored from the place menu alone"
description: "Roadmap f-place-menu-views (from r-place-menu-hide-delete-views, Nick 2026-10-19): views pile up as chats draw them; the person annoyed by the clutter is standing at the drop-down."
lastModified: "2026-10-19T04:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-19: the seam is `keptViews` (`KeptViews` from `@graview/core`) on `mount`, the pages embed and `GraviewProvider`: `current()` answers `{ hidden, removed, may }` synchronously, `onChange` says when it moved, `hide(name)`, `show(name)`, `remove(name, { title, kind })` and `restore(name)` act on a script view the host keeps, and `lens(edit)` takes a declared lens's `set-lens-hidden` or `remove-lens`. The host decides `may` per viewer (views: owner or editor; lenses: owner) and refuses what it did not allow. `registerWorkerView` registers under the manifest's `name`, `registerDeclaredLenses` marks `declared`, and the frame's registry is tidied by `tidyViews` (hidden: `hidden: true`, never the kind's default; deleted: no place, never drawn) so every face agrees at once. The bar's places open the routed face's own menu through `PLACE_MENU_EVENT` (the face keeps a provider of its own under the embed's); on the scene, the scene's. The foot of the drop-down (Hidden with Show, Recently deleted with Restore and its day) is fetched with the bar's panes. The framework's hosts: `/graview/views` on `createStoreHandler` (`views`, `mayTidyViews`; default `keepsTheApp`), `fileViews` beside the store for `graview serve`, `graview preview` writing a lens's change into its document and handing the page the new app, `devViews()` for a dev server. What Cloud does is in the changeset's Compatibility line and on the Roadmap's Cloud half. Budgets raised by files in scripts/budget-raises (a hosted page 5.1 KB up front).
