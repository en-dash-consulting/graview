---
id: "a61e0fff-0eba-44ce-916b-4b888650266a"
level: "task"
title: "0.1.40 · FR-193: A view takes files dropped on it"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.40"
source: "ndx-capture"
startedAt: "2026-10-19T21:30:00.000Z"
completedAt: "2026-10-19T23:00:00.000Z"
endedAt: "2026-10-19T23:00:00.000Z"
acceptanceCriteria:
  - "a fixture view takes three images and a video dropped on a day card as four records on that day in one undoable change"
  - "on a phone (a coarse pointer) a tap on the same element opens the file picker, its accept matching the fields' types"
  - "a view with only accepts (no drop listener) gets the default: a record of the kind per file, its file on its field, linked by data-drop-connect, in one change"
  - "graview.act(name, [args, …]) runs several as one change with one undo, and an act's argument takes a file only as the host handed it"
  - "a seat that may not make the kind is offered no drop target, so nothing is offered and then refused"
  - "the view checker (describe.ts) reports a data-drop whose kind or field is not in accepts, and the headless runner takes accepts"
  - "tests fail first; a browser harness proves the drop with a DataTransfer built in the page, and the picker with setInputFiles"
  - "a face whose files config takes nothing offers no drop and never says \"up to 0 bytes\"; an empty video field on a record whose host takes video/* shows a control to add one"
description: "Roadmap f-views-take-a-drop (FR-193), from Nick's request on a hosted family weekend app's journey home view: drop photos and a phone video from Finder onto a day card and have moments appear there."
lastModified: "2026-10-19T23:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided:

- **The markup and the manifest.** A view marks an element `data-drop="<kind>"`, with `data-drop-connect="<relation>:<record id>"` (split at its first colon) and optionally `data-drop-field="<field>"`. Its manifest says `accepts: [{ kind, field }]`, each field an image, video or file field (or a list of them). `checkManifest` refuses an unknown kind, a field that holds no file, and a kind no act makes with that field.
- **The host owns the drop** (`packages/guest/src/host/drop.ts`, `drop-plan.ts`). They are fetched with the first `data-drop` that a view with `accepts` draws. `planDrop` decides whether an element is a target. It needs host files with `maxBytes > 0` whose kinds take a field's sort, a record the view was shown, a relation on the kind or on the record's kind, and an act this seat may run. That act is either one done to the record that creates the kind and connects the relation (preferred), or a create plus a linker (the derived `connect-<kind>-<relation>`) naming the new record by `{ $made: n }`. Where the plan fails, the element is not marked (`data-graview-drop`). So a seat that may not make the kind sees nothing offered, and the browser keeps its own drop there.
- **Drag over**: `data-graview-drop-over` with a host stylesheet in the shadow root (an outline over the view's styles), and a host `role=status` that says "Drop to add moments to Saturday." The target's `aria-description` says the same. A coarse pointer's tap opens a host-owned `<input type=file multiple accept=…>`, unless the tap lands on a button, link or field inside the target. Enter or Space on the target itself opens it on any pointer.
- **Files** are held to the field their type fits, then to the host's `kinds` and `maxBytes`, stored through `HostFiles.upload`, and checked as a stored file. A picture's size is read with `createImageBitmap` where the host did not say it. What is refused is said one sentence a file in a host `role=alert`, and the rest go on.
- **The default** (a view that does not hear `drop`): `session.change(calls, intent)` → one `store.applyAll`, via `view:<name>`, as the viewer. The intent is "Add 4 moments to Saturday", and the status says "Added 4 moments to Saturday."
- **A view that hears `drop`**: the runtime sends `{ type: "hears", events }` the first time `graview.on` is called for each event type. The host then sends `dom-event` `drop` with `files` (`{ href, name, type, bytes, width?, height?, poster?, duration?, at?, field }`; `at` is the file's lastModified) and `refused`.
- **Acts take files** (`judgeCodeAct`, `CodeActContext`): any argument with an `href` must be a file the host handed (in a drop, or on a shown record), and it is replaced by the host's own copy. Where sight is not total, a code act still needs a press. The exception is one whose every argument is a dropped file, a shown record, a `$made` ref, or an app-declared value, with at least one dropped file.
- **`graview.act(name, [args, …])`**: an act request's `args` may be a list of 1–100 objects, run as one `applyAll`.
- **Core: `{ $made: n }`** (`packages/core/src/mutations/made.ts`). `applyAll` reads it as the first record call `n` of the same change made. That call's permission and agent checks run once it is resolved. A call naming a later call, or one that made nothing, refuses the whole change. The op keeps the resolved id, and the calls go down the wire as asked, so a server resolves them alike.
- **The event shape** is documented, not extended. Every event is `{ type, target, element }` plus what it carries: `value`/`checked` (input, change), `key` (keydown), `pressed` (press, acted), `files`/`refused` (drop). No new keydown keys were added.
- **The guest host reads core's schema marks itself** (`host/marks.ts`: `Symbol.for("@graview/core:file")` and `:node-ref`), so the drop loads no zod. A test holds these readers to core's.
- **5a**: `FilesEditor` (`packages/primitives/src/files.tsx`) offered a picker and said "up to 0 bytes" for `maxBytes: 0`. It now offers nothing and says "This host doesn't take files, so none can be added here."
- **5b**: the framework already draws an empty video field as its editor on the record's page where the host takes `video/*`. This is now held by `packages/pages/tests/unit/an-empty-video-field-offers-a-way-to-add-one.test.tsx`. Cloud's missing control is not the framework's.
- **Skill**: graview-worker-view is at its budget, so the lesson went into graview-view-drawing ("Files a person drops on it"; 10 233 characters).

Tests (failing first):

- `packages/guest/tests/unit/a-view-takes-files-dropped-on-it.test.ts` (18): the marks agree with core, the manifest, a target offered or not (no files, `maxBytes` 0, kinds, a friend), drag-over, the default as four moments in one batch and one undo, the on-day act, refusals in words, a hearing view told the stored files, the view's act of several, a forged file refused, a phone's tap and picker, a button inside the target being the button's, the runtime's `hears` and act list, and the checker.
- `packages/core/tests/unit/a-change-links-a-record-it-makes.test.ts` (3).
- `packages/pages/tests/unit/an-empty-video-field-offers-a-way-to-add-one.test.tsx` (2; the `maxBytes` 0 case failed first).

Harness: `GRAVIEW_PORT_BASE=5600 node scripts/guest-sandbox.mjs --transport=drop` held all its claims in chromium, webkit and firefox. Firefox has no mobile emulation, so its phone claim is not run.

Bundle: raises are in `scripts/budget-raises/views-take-a-drop-*.json`. A hosted page is 742 / 282 more up front (the store's `$made`), and so is a hosted page handed a compiled app (742 / 324). The open-kit guest host is 16 463 / 6 788 more in all, most of it the lazy drop chunk.
