---
"@graview/guest": patch
"@graview/core": patch
---

A guest view can be a named place (FR-87). `guestView` took no title, so an uploaded frame was named by its view's name and could not be one of the app's places. `guestView({ …, title })` now names its frame by the title for assistive technology, and registering it with the same title (`views.register(kind, cell, view, { title })`) makes it a place on both faces: listed by `placesOf`, at `/places/<slug>` on the routed face and `#view=<slug>` in the scene. A frame guest is told of the app's places (`props.places`) and may go to one: `guest.navigate({ place: "the-packages" })`, held to the places the app has as a worker view's links are (FR-93). A link to a record now goes where the face goes, through `useGoTo`, so on the routed face it opens the record's page. A unit test registers "The price sheet" over packages and finds it among `placesOf`'s places with its address and stop, drawn at `/places/the-price-sheet` with its frame named by its title, and no place for a guest with no title.

Compatibility: the wire — `navigate` with a `place` was already in the protocol for worker views; a frame guest's client can now send it, and its props now carry `places`. `GUEST_PROTOCOL` is unchanged. `capabilities().shipped` gains `FR-87`. Ops, stored formats, check codes and tool schemas are unchanged.
