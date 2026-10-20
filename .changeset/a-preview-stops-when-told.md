---
"@graview/ship": patch
"@graview/skills": patch
---

`graview preview` and `graview serve` stop when they are told to, whoever still has them open. A product ran `graview preview app.json --seed seed.json --data data` behind a Vite dev server that proxied `/graview` to it, live socket and all, with a browser open: `kill <pid>` and `kill -INT` left it running, because closing the server waited on the proxied socket, which the proxy kept open. Only `kill -9` stopped it, and the data folder's `graview.lock` went on naming the dead process. Now SIGTERM, SIGINT or SIGHUP tells every live socket the store is closing (1001), cuts the keep-alive connections, gives a socket that keeps its side open 1.5 s before cutting it too, releases the data folder and exits; a close still waiting after 2.5 s, or a second signal, exits anyway. A hold whose process has gone is taken over as before, and the command now says so: `graview preview: took over ./data from a preview (pid 41234, since …), which is no longer running.` The test starts the built bin, holds a half-open live socket and a keep-alive connection, and sends each signal (`a-preview-stops-when-told.test.ts`). The `graview-ship` skill says how a preview stops.

Compatibility: ops, stored formats, the declaration and derived tools are unchanged. The wire: messages are unchanged; `ServedStore.close()` takes `{ grace }` (1500 ms unless said) and now cuts a live socket that has not gone within it, where it used to wait for it forever. `StoreHold` gains `tookOverFrom`.
