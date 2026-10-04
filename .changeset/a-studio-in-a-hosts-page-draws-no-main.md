---
"@graview/studio": patch
"@graview/embed": patch
"@graview/core": patch
---

A studio in a host's page draws no `<main>` of its own (FR-58). Graview Cloud's builder mounts the studio through the embed's `studio: { onApply }` into an element inside its own page, and the studio drew its picture in a `<main>` inside the embed's labelled section — so axe failed the host on `landmark-main-is-top-level` and `landmark-no-duplicate-main` whatever the host did, since a main inside the embed's region can never be top-level. Now `StudioPlace` takes `landmark: "main" | "region"`, and omitted it follows `within`: a boxed studio, which is every embed's, draws its picture as a region named "The declaration", and a page-filling one keeps its main. The embed's `studio` option takes the same `landmark`, for a host whose whole body is the studio, and its type is exported as `EmbedStudio`. A test builds a page the way Cloud's is (a header, a nav, its main, a footer), opens the studio in it, and runs axe's landmark rules and `region` over the whole document: nothing; with `landmark: "main"` axe reports the two rules Cloud did. `capabilities().shipped` names FR-58.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-58`. An embed's studio draws a labelled `section` where it drew a `main`; a host that selected the studio's `main` selects `[data-testid="studio"] section[aria-label$="The declaration"]`. Ops, stored formats, check codes and tool schemas are unchanged.
