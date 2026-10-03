---
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

The pages alone draw the app's views, and a view that throws on a page says so in its own place. `@graview/embed/pages` takes `views(schema, registry)` as `mount` does. Its pages draw from the same registry: the framework's defaults, the declaration's view specs, then the host's own (FR-35 on the pages-only entry). The pages face of `mount` gets the registry, the app's settings and presence through the same `PagesContent`. `mount` takes `heading` (FR-25) beside the frame options. On the pages, a lens or a kind's own group view that throws draws behind a `ViewBoundary`, as it does in the scene. The rest of the page keeps working, and the host's `onError` hears of it (FR-24).

The pages-only bundle's budget is raised from 765 kB to 815 kB minified, and from 205 kB to 220 kB gzipped. The growth is the default views and view specs the pages now draw from: about 48 kB minified and 15.5 kB gzipped.

Compatibility: additive — `views` moves from `EmbedOptions` to `FrameOptions`, so both entries take it. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
