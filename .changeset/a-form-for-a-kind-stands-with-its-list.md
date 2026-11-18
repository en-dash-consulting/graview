---
"@graview/core": patch
"@graview/guest": patch
"@graview/primitives": patch
---

A frame view that makes its kind's records is listed beside that kind's list in the app bar, not under Pictures. A Thanksgiving app's "Add a dish", a view of the dishes that presses "add-dish", stood under Pictures, away from the dishes it adds. A host's view whose manifest `acts` include one that creates the view's kind is now a way in to that kind (`barPlaces` lists it in the `lists` group, right after the kind's list); a view that only pictures, or changes records it does not make, stays under Pictures. A place carries the acts its view may ask for (`Place.acts`, `ViewMeta.acts`, from the manifest's `acts`), which is how the bar knows. Held by a unit test of primitives (`a-form-for-a-kind-stands-with-its-list`).

Compatibility: unchanged on every surface — a place and a view's registration carry one more optional property (`acts`); a host's views are drawn and addressed as before, and only where the bar lists one moves.
