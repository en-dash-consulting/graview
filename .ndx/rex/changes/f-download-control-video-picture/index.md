---
id: "1d08c689-7c2a-48b3-82a9-3957c46ca541"
type: "change"
title: "A video's figure and a picture's full-size dialog carry a Download control"
slug: "f-download-control-video-picture"
intent: "From Cloud's brief b-cloud-2026-11-18-download-control (Nick's Video Studio: download a render from a phone). A document line already has Open / Download; VideoPlayer's figure has none, and the full-size picture dialog has only Close. Ask: a visible Download link in the video figure's caption and in the picture dialog, to fileSrc(href) with ?download=1 (Cloud answers Content-Disposition: attachment), a full-size touch target, accessible name \"Download <file name>\". Cloud's half is feature:f-download-kept-files."
acceptanceCriteria:
  - "A video field's figure shows a Download link to its file with ?download=1 under the host's base (test)"
  - "The full-size picture dialog shows a Download link beside Close (test)"
  - "Each is named \"Download <file name>\" and is at least 44 px square on a phone (test or harness claim)"
priority: "medium"
tags:
  - "graview"
  - "primitives"
  - "hq:feature:f-download-control-video-picture"
source: "Graview HQ feature:f-download-control-video-picture"
---
