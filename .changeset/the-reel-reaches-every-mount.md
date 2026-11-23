---
"@graview/guest": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
---

The app's reel reaches every view the framework mounts, and frame guests too. A reel handed to `GraviewProvider`, the Shell or the routed face (`PagesApp`'s context) now reaches each worker view drawn under it, and follows it: where a host started or stopped handing a reel, every view under it — and the whole app with it — was drawn afresh. Each now holds the reel the same way whether one is handed or not, so a change moves the value alone and the views already drawn are pushed again; a Shell or a routed face handed no reel keeps the one the provider around it was handed. A frame guest (`mountGuestView` on `@graview/guest/host/frame`, and `guestView` with a `url`) is now handed the reel as a worker view is: its facts in `props.theme.reel` (`name`, `caption`, `type`, `duration`, `poster`, `playable`, `width`, `height`, `aspect`), never its address, its poster's or its captions', pushed again when the host hands another and gone when it hands none. `mountGuestView` takes `reel`, and `guestView` reads the one its page was handed. A frame places no player of the host's: it is another origin. Held by unit tests of the guest (`a-view-the-framework-mounts-is-handed-the-apps-reel`, `a-frame-guest-is-handed-the-apps-reel`).

Compatibility: the wire — additive: a frame guest's `props.theme` carries `reel` where the host handed one, as a worker view's already did; a guest that reads none of it is drawn as before. Ops and primitives, stored formats, derived tool names and input schemas, and the declaration and check finding codes — unchanged. What Graview Cloud does: nothing new where it already hands `reel` to `mount` or `<Embed>`; a frame guest it mounts by hand with `mountGuestView` is handed the reel with `reel`.
