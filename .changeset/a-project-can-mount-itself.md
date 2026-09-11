---
"@graview/embed": patch
"@graview/core": patch
---

A project can mount itself. `EmbedOptions.views` was typed as the erased return of `registerDefaultViews`, so passing the registry an app wrote for its own declaration — the only thing the option is for — was a type error; it is typed to the app's schema now. And a scaffolded project gains `@graview/embed` as a dependency, its dev alias, and an `embed.html` + `src/embed.tsx` to put one in, so the last rung of the pages skill is something a new project can actually climb.
