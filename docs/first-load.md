# The first load and a page switch

Roadmap f-perf-first-load, from Nick's report on the Graview Roadmap in
Graview Cloud (2026-10-15): "too slow to load initially and between pages".

## How it is measured

`pnpm verify first-load` (`scripts/verify-first-load.mjs`) serves Graview
Cloud's shell as `graview preview` builds it: the page bundled as Cloud
bundles it (esbuild, split, minified, React inside), handed the compiled app,
the store opened over the wire with `openRemote`, the embed mounted as the
whole page on the routed face. It is served gzipped and over HTTP/2, as
Cloud's host serves it (`scripts/lib/secure-front.mjs`), and timed in
headless Chromium over two apps:

- **the roadmap**: `scripts/fixtures/roadmap/roadmap.gdd.json`, its seed
  grown to the Roadmap's size today: 190 features under 14 areas,
  60 requests, 18 people, 28 releases and 20 briefs (330 records, about 600
  links), and four lenses on its home (two boards, a coverage, a calendar);
- **the tasks**: `packages/core/tests/document/fixtures/tasks.gdd.json`, a
  small team's tasks the size of the todo example (16 tasks, 4 people, one
  board).

On two profiles:

- **desk**: 1280 × 800, the machine as it is, a host 40 ms away at
  20 Mbit/s;
- **phone**: 390 × 844, the CPU slowed four times, and DevTools' slow 4G
  as Lighthouse's mobile run applies it (562.5 ms of latency, 1.47 Mbit/s
  down, 675 kbit/s up).

And four numbers, each the median of three cold runs (no cache, a new
browser context):

- **first useful paint**: the face drawn and painted, the app's bar and its
  home;
- **interactive**: the end of the last long task (over 50 ms) before two
  quiet seconds on the main thread, from the useful paint on;
- **list → record**: a press on a list's first row until the record's page
  is painted (and settled: its last long task over);
- **pages → scene**: a press on the bar's Scene until the scene's ground is
  painted (and settled).

A switch is pressed once the page is interactive and has been quiet for two
seconds. The baseline is the same harness over the framework before this
work, with the page fetching its face beside the document, as Cloud's shell
already does (`preload(face)`).

Measured on a MacBook Pro (M2 Max), 2026-10-16.

## Before and after

| App | Profile | Measure | Before | After | Change |
|---|---|---|---|---|---|
| roadmap | desk | first useful paint | 518 ms | 323 ms | −38% |
| roadmap | desk | interactive | 518 ms | 323 ms | −38% |
| roadmap | desk | list → record | 14 ms | 13 ms | −7% |
| roadmap | desk | pages → scene | 343 ms | 37 ms | −89% |
| roadmap | phone | first useful paint | 5.54 s | 3.42 s | −38% |
| roadmap | phone | interactive | 7.61 s | 5.20 s | −32% |
| roadmap | phone | list → record | 56 ms | 55 ms | −2% |
| roadmap | phone | pages → scene, painted | 785 ms | 792 ms | +1% |
| roadmap | phone | pages → scene, settled | 2.15 s | 1.75 s | −19% |
| tasks | desk | first useful paint | 453 ms | 311 ms | −31% |
| tasks | desk | interactive | 453 ms | 311 ms | −31% |
| tasks | desk | list → record | 19 ms | 13 ms | −32% |
| tasks | desk | pages → scene | 319 ms | 31 ms | −90% |
| tasks | phone | first useful paint | 5.08 s | 3.36 s | −34% |
| tasks | phone | interactive | 5.08 s | 3.36 s | −34% |
| tasks | phone | list → record | 53 ms | 51 ms | −4% |
| tasks | phone | pages → scene | 778 ms | 780 ms | ±0% |

At a desk the list → record and pages → scene numbers are the same painted
and settled. Before this work, `graview preview` itself served its page
uncompressed over HTTP/1.1 and fetched its face only after the store
opened: the roadmap on the phone was useful at 12.5 s.

### Against the ask

- **Cold load to interactive, 30% faster on both profiles**: met. The
  roadmap is 38% faster at a desk and 32% on the phone, the tasks 31% and
  34%. At a desk both are interactive in about a third of a second, under
  the 2 s bar.
- **A page switch, 30% faster on both profiles, or under 300 ms at a
  desk**: met at a desk, where a switch to a record takes 13 ms and to the
  scene 37 ms, down from 343. **Not met on the phone.** A switch to a record
  was already 55 ms there, the record page's code arriving with the face,
  so there was nothing of size to take away. A switch to the scene is the
  scene's own chunks, fetched over a slow 4G when it is pressed: on a phone the other face is not fetched while idle, because
  the reader's network is spent on the page they opened first. A hand
  reaching for the switch starts the fetch (`BarFace.reach`), which a
  harness's press does not show. What the work did take from it is the
  scene settling after it is drawn, 19% sooner, its chunks now fetched side
  by side.

## What was slow, and what changed

Read from the phone's network waterfall and the main thread's long tasks,
largest first.

1. **The store opened two round trips after the page ran, and then waited
   for its socket.** The page fetched the document, built the app, then
   asked `/graview/state`, then waited for the live socket's welcome before
   it mounted: three round trips of 562 ms in a row. `graview preview` now
   hands the state with the document (the answer `/graview/state` gives the
   seat), `openRemote` takes it as `state` and opens on it without asking,
   and the preview's page opens without waiting for the welcome
   (`openTimeoutMs: 0`), polling until the socket is up. About 1.2 s of the
   phone's first paint.
2. **The page was fetched a level at a time.** The browser reads a chunk
   before it learns the chunks it imports, so the entry, its chunks, the
   face's door and the face's chunks were four round trips. The preview's
   page now names in its head every chunk the entry and the opening face
   import (`modulepreload`) and the document (`preload`), and every
   `import()` in it names the chunks its door needs as it is opened
   (`doorsOpenAtOnce`, `preloadLinks` in `scripts/lib/hosted-page.mjs`). A
   lens on the home arrived three round trips after it was asked for; now
   one.
3. **Every picture on the home was fetched and drawn before the page
   answered.** The roadmap's home draws four lenses; a phone shows the first.
   A picture is now drawn as it comes within half a screen of the window.
4. **A switch to the scene waited on a placeholder.** The scene drawn before
   its chunk was here suspended into the ground that stands in for it, and
   React holds the content back for 300 ms after a placeholder is shown.
   A press now fetches the scene first and keeps the page drawn meanwhile,
   for at most 150 ms; at a desk the other face is fetched once the page is
   idle, so the switch draws at once.
5. **The answers went uncompressed.** `graview serve` and `graview preview`
   now gzip what they send a browser that takes it, as a host in front of
   a page, Cloud's among them, does.

Not changed, and why: the bytes a page needs before it draws (about 310 KB
gzipped with the opening face) are the phone's floor at 1.47 Mbit/s, and
the up-front page is already held to the hosted page's budget. Splitting the
routed face's pages behind doors of their own would take about 28 KB gzipped
(0.15 s on the phone) off the first paint and put a round trip on the first
visit to a list or a record, so it was left.

## What Graview Cloud can take from it

Cloud's shell (`packages/client/src/shell.ts`) already fetches its face
beside the document. The rest is Cloud's to adopt:

- hand the store's state in `/graview/document` beside the compiled app and
  pass it to `openRemote` as `state`, with `openTimeoutMs: 0`;
- in `packages/client/build.mjs`, write `modulepreload` links for the shell's
  chunks and the opening face's, and rewrite each `import()` to name its
  door's chunks, as `scripts/build-preview-page.mjs` does with
  `preloadLinks` and `doorsOpenAtOnce`.

The rest of this work (the scene switch, the idle fetch of the other face,
the pictures drawn as they near the window) arrives with the packages.

## What CI holds

- **The bytes**: the hosted page's budget
  (`tests/a-hosted-page-keeps-to-its-budget.test.ts`) holds what the page
  loads up front and before either face draws, and the embed's
  (`tests/the-embed-keeps-to-its-budget.test.ts`) what each face loads
  first. A raise is a file in `scripts/budget-raises/`.
- **The time**: the CI job `first-load` runs `scripts/verify-first-load.mjs`
  on every pull request and fails when a median is over `TIMING_BUDGET`:
  at a desk 2 s cold and 300 ms a switch, on the phone the numbers above
  with room for a runner two or three times slower than a laptop. The
  verdict is `docs/first-load.json`, kept as the job's artifact.
