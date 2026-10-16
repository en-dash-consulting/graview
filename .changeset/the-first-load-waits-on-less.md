---
"@graview/ship": patch
"@graview/embed": patch
"@graview/primitives": patch
"@graview/pages": patch
"graview": patch
---

The first load and a page switch wait on less, and are timed (Roadmap f-perf-first-load, from "too slow to load initially and between pages"). `pnpm verify first-load` serves Graview Cloud's shell as `graview preview` builds it over a roadmap the Graview Roadmap's size and a small team's tasks, at a desk and on a slow phone, and CI holds its medians to a budget; docs/first-load.md has the numbers before and after. On the phone the roadmap is interactive in 5.2 s where it took 7.6, the tasks in 3.4 s where they took 5.1; at a desk the scene draws 37 ms after a press where it took 343.

A press for the scene fetches it first and keeps the page drawn meanwhile, for at most 150 ms, rather than suspending into a placeholder that React then holds for 300 ms; at a desk the other face is fetched once the page is idle, and the bar's switch fetches a face as a hand or the keyboard reaches for it (`BarFace.reach`). A picture on the home is drawn as it comes within half a screen of the window, so a phone no longer fetches and lays out every lens before it answers a press. `openRemote` takes the store's first `state` when the host already sent it, and opens on it without asking; `graview preview` hands it with the document, and its page opens without waiting for the socket's welcome. `graview serve` and `graview preview` send their answers gzipped to a browser that takes them, and the preview's page names the chunks it needs in its head and asks for every chunk a door needs as the door is opened, rather than a level at a time.

It adds 1.0 KB more up front to a hosted page (1,042 bytes, 405 gzipped), and its raises are filed in `scripts/budget-raises/`.

Compatibility: the wire: a served answer is gzipped when the request accepts gzip (`content-encoding: gzip`, `vary: Accept-Encoding`), and the preview's `/graview/document` carries `state`, the answer `/graview/state` gives its seat; `openRemote` takes an optional `state`, and `RemoteState` is new on `@graview/ship`, `/browser` and `/runtime`. `BarFace` takes an optional `reach`.
