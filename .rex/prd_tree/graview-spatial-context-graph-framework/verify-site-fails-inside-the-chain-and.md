---
id: "0dda5dcd-a4cc-477e-8fc1-73e7d05fded2"
level: "task"
title: "verify-site fails inside the chain and passes on its own"
status: "pending"
priority: "medium"
tags:
  - "harness"
  - "quality"
  - "flake"
source: "Found on 2026-09-22 while verifying e43520bf with the new pnpm verify chain."
acceptanceCriteria:
  - "verify-site gives the same verdict inside the chain as it does on its own, ten runs in a row"
  - "Its page loads do not depend on the network resolving — fonts and any other remote asset are either local or explicitly waited for"
  - "When it does fail, the chain's output names the check that failed"
description: "Seen on 2026-09-22, the first time the full chain ran after `pnpm verify` existed. `verify-site` failed in 42s inside the chain and passed in 350s run on its own immediately afterwards, against the same files — it reads `file://docs/site/...` and serves nothing, so this is not port contamination or a borrowed dev server. The 42s against 350s is the tell: it did far less work before giving up. The likely cause is `waitUntil: \"networkidle\"` on pages that pull webfonts, which resolves differently depending on what the network is doing — a harness whose verdict depends on the internet is a harness that will go red for reasons nobody can act on. FOUND AT THE SAME TIME, in the runner rather than the harness: `verify-all.mjs` printed the last twenty-five lines of a failing harness, and `verify-site` prints one line per passing check — so its single failure scrolled off and the report showed nothing but `ok`. That is the exact problem the chain exists to solve, arrived at from the other side. Fixed in the same commit: the runner now shows every line that is not a plain `ok`, falling back to the tail when there are none."
lastModified: "2026-09-22T14:35:28.371Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
