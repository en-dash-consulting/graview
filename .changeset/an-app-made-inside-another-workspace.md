---
"@graview/core": patch
---

`graview create` in a directory under a pnpm workspace that does not list it makes the app a workspace of its own and installs it. pnpm installs the nearest workspace going up, so the install said "Done" having installed the workspace above, and the new app had no `node_modules`: the skills were "not written" and every import was a type error. Where the install leaves nothing in the app, create writes a `pnpm-workspace.yaml` there, says why, and installs again; a workspace that lists the app installs it as before.

Compatibility: no surface changes.
