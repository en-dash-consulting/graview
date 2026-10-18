---
"@graview/core": patch
"@graview/ship": patch
"@graview/primitives": patch
"@graview/guest": patch
"@graview/skills": patch
---

A record's pictures and documents load where the host serves them, on every face. A record keeps its file at the path the host's upload answered (`/graview/files/…`), without the base the app is served under, and the face drew `<img src>` and every link and download at that path; Graview Cloud serves an app at `/a/<app>/` and its files only under it, so every thumbnail, gallery, picture full size, inline PDF and download asked the workspace's root and broke. `HostFiles` now says where it serves a file (`src(href)`), and every place the framework draws, links or downloads a record's file goes through it (`fileSrc(files, href)` from `@graview/core`), the href itself where the host does not say. `filesAt(url)` derives it from its own url: an href under `/graview/files/` is drawn under `url`, so a host that already hands `filesAt(base + "/graview/files")` gets its pictures under its base with nothing else changed; the dev door's `/__graview/files/…` is drawn as it is. A worker or frame view the framework mounts as a kind's view takes its `file` from the page's `files.src` unless its definition gives one. What the page says of a file (`data-graview-thumb`, `data-graview-full`, `data-graview-removed-later`) and what it asks `kept` still name it by the href the record keeps. The `graview-ship` and `graview-view-drawing` skills say so. The guest host's first load grows by under 200 bytes for it, and its two budgets are raised by that.

Compatibility: ops, stored records, the declaration and the guest wire are unchanged. `HostFiles` takes an optional `src?(href: string): string`; a host without it draws each file at its href as before. `filesAt` answers `src`, which draws an href under `/graview/files/` under its url — a host that handed `filesAt` a url elsewhere than its files' own address now draws its files at that url. `WorkerViewDefinition.file` and `guestView`'s `file` default to the page's `files.src`.
