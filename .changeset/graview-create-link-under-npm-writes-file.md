---
"@graview/core": patch
---

`graview create --link` run by npm writes dependencies npm installs. It wrote pnpm's `link:` whichever package manager made the project, and npm refuses `link:` outright ("Unsupported URL Type"), so a project linked to a checkout and made with npm could not be installed. Under npm the framework is now `file:` to each package's directory, which npm links; under pnpm it is `link:` as before.

Compatibility: no surface changes.
