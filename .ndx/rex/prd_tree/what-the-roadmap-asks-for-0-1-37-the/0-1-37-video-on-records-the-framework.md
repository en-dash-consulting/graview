---
id: "da6c6b28-d952-4ccf-afcf-3d3dbd8c8c4d"
level: "task"
title: "0.1.37 · Video on records: the framework half"
status: "pending"
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
lastModified: "2026-10-18T21:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
