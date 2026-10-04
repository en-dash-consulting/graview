---
"@graview/embed": patch
"@graview/skills": patch
"@graview/core": patch
---

A host whose page is the studio hands it in, and waits for no chunk (FR-63). The embed imports its own studio when it is first drawn, which is right for a page that may never open it and a round trip for one whose whole point is the studio: Graview Cloud's builder fetched about 109 kB before the studio drew. Now the embed's `studio` option takes `place: StudioPlace`, imported by the host from `@graview/studio`: the embed draws it in the render that mounts it, with the host's `onApply`, `landmark` and `offered`, and never imports its own. A flag (`eager: true`) could not do this, since what a bundler splits is decided by what the code imports, not by a value, so the studio is handed in instead. `scripts/lib/bundle-budget.mjs` reads which `@graview/*` packages esbuild's metafile leaves in a chunk the entry does not import outright, and a new budget, "embed with the studio handed in", fails when any `@graview/studio` module is in one (`lazyLacks`); `pnpm pack:inspect` holds it with the others. A jsdom test mounts an embed with a stand-in handed in and finds it drawn in the first render, and the embed's own studio never imported. The graview-embed skill says when to hand it in, and what `onApply` may answer. `capabilities().shipped` names FR-63.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-63`. `place` is a new optional field of the embed's `studio` option; without it the studio is fetched when drawn, as before. Ops, stored formats, check codes and tool schemas are unchanged.
