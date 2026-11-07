---
id: "4d7c1b2e-9a63-4f0e-b1d8-62c5e0f3a917"
type: "capability"
title: "A guest view is handed the pictures it may show, behind their own door (FR-162)"
slug: "a-guest-view-is-handed-the-pictures-it"
statement: "A guest view, whether a frame or a worker, that declares it in its manifest is handed the pictures on the records it reads as addresses it can put in an img, made by the host page from the bytes and behind a door of their own, within the guest host's budgets."
criteria: [{"id":"c1","text":"When a guest view (frame or worker) declares the pictures door in its manifest, the guest host shall hand it, for each file value on a record it reads, an address it can put in an img, made by the host page from the bytes as a blob: or data: URL."},{"id":"c2","text":"The guest host shall never hand a guest view the host's path to a file, which a sandboxed frame cannot load with the reader's credentials."},{"id":"c3","text":"The guest host shall fetch only files on records the guest is handed, under the reader's sight, and shall never fetch for a guest a file on a record the seat may not see."},{"id":"c4","text":"The guest host shall keep the pictures it hands a view within a byte cap per view and per file."},{"id":"c5","text":"When a picture is left out because of a byte cap, the guest host shall say so in the manifest's words."},{"id":"c6","text":"When a picture is larger than a view needs, the guest host shall hand it downscaled."},{"id":"c7","text":"The guest host shall hand as addresses only pictures of type image/* other than SVG."},{"id":"c8","text":"When a file is a document rather than a picture, the guest host shall hand the guest its name, type and size."},{"id":"c9","text":"If a guest does not ask for pictures, the guest host shall hand it nothing new."},{"id":"c10","text":"The guest host shall keep GUEST_PROTOCOL unchanged when it hands pictures to guests that ask for them."}]
tags:
  - "roadmap"
  - "graview-cloud"
  - "FR-162"
  - "guest"
  - "files"
  - "FR-175"
source: "The review after the files (review/after-the-files, with #223): FR-162 asks that views be handed the addresses they may put in an img, as theme.logo is; #223 does it for the framework's own faces and blocks, not for a guest frame or worker view"
priority: "medium"
resolution: "Shipped as FR-175 on feat/fr-175-guest-view-pictures: a worker view whose manifest says `pictures` (and a frame whose host passes `pictures`) is handed each file on a record as a GuestFile, a picture with a blob: or data: `src` the host made from bytes fetched as the reader, downscaled to the view's width within per-picture and per-view byte budgets, `left` saying why one was left out, a document by name, type and size; GUEST_PROTOCOL stays 1. Covered by @graview/guest unit tests and guest-sandbox --transport=pictures in Chromium, WebKit and Firefox."
---

A worker view or a guest frame runs at an opaque origin and is handed values, so a record's FileValue reaches it as a path it cannot load (the host serves files to the app's members, with credentials, same-origin). theme.logo is handed as a data: URL for that reason. Give guests the same for the pictures on records they read, behind a door of their own in the manifest and inside the guest host's budgets, so a view somebody else wrote can show a job's photos without the host lending it its origin.
