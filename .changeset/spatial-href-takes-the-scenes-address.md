---
"@graview/pages": patch
"@graview/core": patch
"@graview/skills": patch
---

`spatialHref(id, sceneHref = "/")` takes the scene's address, as `placeHref` already did. It answered `/#focus=<id>` whatever the host, so a host whose scene lives at `/scene/places/overview` could not link a page of its own to a record there. Now `spatialHref("plot:north-bed", "/scene/places/overview")` is `/scene/places/overview#focus=plot%3Anorth-bed`, and unsaid it is `/` as before. A project `graview create` writes passes its PagesApp context's `sceneHref` to it. The `@graview/pages` README and the `graview-pages` skill say to set `sceneHref` in the PagesApp context when the scene is not at `/`, and pass it on.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `spatialHref(id)` answers what it did.
