---
"@graview/guest": patch
"@graview/skills": patch
---

A view whose manifest says `pictures` is handed each picture's `src` where its app is served under a base, and in a headless run. A record keeps its file at a path on the host (`/graview/files/…`), and the host fetched it at that path resolved against the page; Graview Cloud serves an app at `/a/<app>/`, so the fetch reached the workspace's root instead of the app, and a photo gallery's view never got `src`. A host now says where a record's files are with `file` on the view's definition (and on `mountWorkerView` and a frame's `mountGuestView` and `guestView`): `(href) => base + href`. A picture the host did not answer for says what it answered (`the host answered 401`, or the type it sent) and, where `file` was not given, names it, in the view's `left`, its console and the host's problems; it still never names the path. A headless run (`runWorkerViewHeadless`, what Cloud's `propose_view` runs) fetches nothing, and now hands each picture a stand-in `src`, a blank image, so the view's `<img>` is drawn and judged as it will be on the page rather than skipped. The `graview-view-drawing` skill says both.

Compatibility: ops, stored records, the declaration and the guest wire are unchanged. `WorkerViewDefinition`, `mountWorkerView`, `mountGuestView` and `guestView` take `file?: (href: string) => string | undefined`; without it a file is fetched where it was before. A headless run hands a picture `src` (`PICTURE_STAND_IN`) where it handed none.
