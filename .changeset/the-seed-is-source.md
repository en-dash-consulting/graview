---
"@graview/core": patch
---

A project `graview create` writes keeps its seed in version control. Its `.gitignore` said `data/` for the store `graview serve --data data` writes, which also matched `src/data/` — so every project's seed, the graph it opens on, was quietly never committed. It now ignores `data/` wherever the app sits and keeps `**/src/data/`, in the single-app layout and the workspace one alike.
