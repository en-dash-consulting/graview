---
id: "da6c6b28-d952-4ccf-afcf-3d3dbd8c8c4d"
level: "task"
title: "0.1.37 · Video on records: the framework half"
status: "completed"
startedAt: "2026-10-18T22:00:00.000Z"
completedAt: "2026-10-19T00:30:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "a video field type (or video kinds allowed on a file field) with value { href, name, type, bytes, poster?, duration?, width?, height? }, uploaded through HostFiles like pictures"
  - "the face plays a record's video (poster first, native controls, keyboard and captions-ready), and a view can place a host-drawn player (e.g. <graview-video data-record data-field>) plus open a full-screen viewer, without being given <video>"
  - "the document schema, checker, act forms and skills know it; tests fail on 0.1.36; transcoding, poster and duration extraction are written as Cloud's half"
description: "Roadmap request:video-on-records-a-video-field-transcoding-poster-frames-and-a-player-views-can-place (layer unsure). add_file takes no video, there is no video field, views may not draw <video>."
lastModified: "2026-10-19T00:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-18, branch feat/video-on-records (changeset a-record-holds-a-video.md).

Decided: a `video` field type of its own, beside `image`, rather than video kinds on a file field — `image` already is "a file field held to one family", so `video` is the same shape (`videoField()`, `{"type": "video"}`, `{"type": "list", "of": "video"}`, `fileKindOf` answers `"video"`, the form and the argument shape say `video: true`). The value stays `FileValue`, with three optional keys: `poster` and `captions` (paths on the host, held to `safeFileHref`) and `duration` (seconds, finite, above 0). Words: `videoWords` ("a 45-second video") on the main entry, `videoClock` ("0:45") on `/blocks`.

The face (primitives' lazy files part): a player with the poster first, native controls, `preload="metadata"`, `playsinline`, a captions `track` when the value has one, sized from width/height (at least 320 px across where there is room), its length read from `loadedmetadata` when the value does not say it; a card or row thumb is the poster (or a muted first frame with no controls, out of the tab order) with a play glyph and the clock. The editor takes `video/*` as picked, refuses a picture for a video field and a host answer that is not a video.

A worker view: `<graview-video data-record data-field [data-index]>` is the open kit's one host-drawn element (empty; data-* only); the host draws the player in a shadow root of its own from the records the view was last shown (`media.ts`, a lazy chunk). `data-lightbox` on an element opens the host's full-screen viewer (a modal dialog appended to the page's body) on the viewer's trusted press only. Permission reuses the manifest's `pictures` rather than a new `media` key. Remote DOM sends no attributes of a hyphenated element unless told, so the worker runtime tells it (`updateRemoteElementAttribute`). A frame guest places none (another origin). Videos are handed to a view as facts (`GuestFile.duration`), never an address.

Cloud's half, as written for the Roadmap: `add_file` and `POST /graview/files` accept `video/*` (at least `video/quicktime`, `video/mp4`, `video/webm`) with a byte limit fit for 12–45 s phone clips; transcode HEVC/MOV to H.264/AAC MP4 (`+faststart`) and answer `type: "video/mp4"` and the MP4's `href`, keeping `name` as picked; extract a poster frame (a JPEG at about 1 s, stored under `/graview/files/…`) and answer `poster`; answer `duration` (seconds), `width` and `height` (after rotation); optionally `captions` (a `.vtt`). Serve video with `Accept-Ranges: bytes` and 206 partial content (WebKit plays nothing without it), `Content-Type` as stored, inline, `nosniff`; list `video/*` in the `kinds` the page's `filesAt` is handed. A host that answers before transcoding finishes may answer the original and update the record later; the face reads length from metadata meanwhile.

Verified: tests written first and failing (core a-record-holds-a-video, primitives a-record-plays-its-video, guest a-view-places-a-records-video, ship the-files-door's videos); then `pnpm typecheck`, full `pnpm test`, `pnpm verify files --quick` (new claims aVideoPickedIsKeptByItsActAndPlayedWithNativeControlsAndItsLength and theListsRowDrawsAVideoAsItsFrameWithAPlayGlyphAndItsLength, also run in WebKit and Firefox) and `pnpm verify guest --quick` with the pictures transport's reel step (a placed clip played poster first, the lightbox opened and closed by Escape) in all three engines, each with GRAVIEW_PORT_BASE=5800.
