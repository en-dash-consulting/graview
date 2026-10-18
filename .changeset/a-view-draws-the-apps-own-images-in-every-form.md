---
"@graview/guest": patch
"@graview/skills": patch
---

A view draws the app's own image however it writes the address, and a headless run can draw one at all. `add_image` answers `/graview/assets/<sha256>.<ext>`; a view that wrote it under the app's base (`/a/<app>/graview/assets/…`) or as the page's own address for it was refused, and a headless run — Graview Cloud's `propose_view` — refused every one, since it had no way to hear where the app's images live. Each form is now the one image, handed to the host's `asset` as its path; another origin, a path that climbs and a query are still refused. `runWorkerViewHeadless` takes `asset` and `origin`, as the live page takes `asset` and is on its origin. The sentence a refused image says offers only what this host draws: the app's own images only where it passed `asset` (and, where it did not, says so by name), `https:` images only from the origins it lists, and an address of the app's own image on another origin is told to be written as its path.

Compatibility: ops, stored records, the declaration and the guest wire are unchanged. A headless run's input may carry `assets` and `origin` beside `imageOrigins`. `sayRefusal(refusal, host)` takes `{ origins, assets }` where it took the origins.
