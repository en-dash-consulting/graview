---
"@graview/core": patch
"@graview/guest": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

A worker view can play the app's own video, not only a record's. Graview Cloud keeps one reel for each app — the video its share preview plays — and a view had no way to show it: `<graview-video>` played only a file on a record the view was shown, and a bare `<video>` is never drawn. A host now hands the reel as `reel` (an `AppVideo` on `@graview/core`: `href`, `poster`, `duration`, `playable`, and optionally `type`, `name`, `caption`, `captions`, `width`, `height`) to `mount` or `<Embed>`, `GraviewProvider`, the Shell, the routed face, `mountWorkerView`, or a headless run, and a view places it with `<graview-video data-app="reel">` — `autoplay` and `cover` as for a record's video. The host draws the player; the view reads the reel's facts in `props.theme.reel` (`GuestReel`: `name`, `caption`, `type`, `duration`, `poster`, `playable`, `width`, `height`, `aspect`) and is never handed its address. It is the app's, not a record's, so a view whose manifest asks for no pictures places it too. With no reel handed, the element draws nothing and the host's problems say why (`media-not-drawn`); a headless run says the same among its problems, and lists a reel it plays in its description's `videos` with `app: "reel"`, which `placeText` says as "(the app's reel)". `useHostReel` and `HostReelContext` on `@graview/react` read what was handed. The `graview-view-drawing` skill says how to place it. Held by unit tests of the guest (`a-view-plays-the-apps-reel`, `a-mounted-view-is-handed-the-apps-reel`), the embed (`a-host-hands-the-apps-reel`) and core (`a-place-description-lists-its-videos`).

Compatibility: the wire — additive: `props.theme` carries `reel` where the host handed one; a view that reads none of it is drawn as before. A place description's video (`DescribedVideo`) — `record` and `field` are now optional, absent for the app's reel, which says `app: "reel"`; a host that reads `record` of every video reads it only where `app` is unset. Ops and primitives, stored formats, derived tool names and input schemas, and the declaration and check finding codes — unchanged. What Graview Cloud does: hand the app's reel as `reel` where it mounts or embeds an app and where it runs a view headless (`describe_place`, `propose_view`), from the same facts `describe_app`'s `reel` says.
