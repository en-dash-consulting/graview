# @graview/guest

A view somebody else wrote — a recipe card, a bespoke dashboard, React or
plain script — drawn in an iframe that can see only what the viewer may see
and can only ask. The host pushes the view's props as the viewer sees them;
the guest asks for an act by name, and the host applies it as the viewer, so
the policy refuses on the guest's behalf exactly as it would refuse a click.
The rail says the act came through the view.

## In the host

```ts
import { guestView, mountGuestView } from "@graview/guest/host";

views.register("recipe", { fidelity: "full", cardinality: "one" },
  guestView({ url: "https://cards.example/recipe.html", name: "recipe-card" }));

// Or without React, into any element:
const frame = mountGuestView(element, { url, view: "recipe-card", store, principal, input: () => ({ node: { id } }) });
frame.update();   // the input moved
frame.dispose();
```

`mountGuestView` gives the frame `sandbox="allow-scripts"` and never
`allow-same-origin`, so its origin is opaque and no cookie, storage or store
of the host's is reachable from it. A `guest-ready` is answered only from
that frame's own window and from the opaque origin, with a fresh nonce and a
MessageChannel; every request over the port carries the nonce. Acts are
rate-limited per frame (30 a minute by default, `limits`), and a flood of
messages past 120 a second is dropped unread. `createGuestHost` is the same
host without the DOM. Where the frame is served from, and its CSP, are the
host's business: a separate registrable domain with `connect-src 'none'` is
the shape the protocol assumes. It matters where the host's session rides a
cookie: in Firefox and WebKit a guest with no CSP can send a credentialed
request to the host that carries a cookie without SameSite. It cannot
read the answer, but the request is made. Set the cookie SameSite=Lax or
Strict, or serve guests with `connect-src 'none'`
(`scripts/guest-sandbox.mjs` checks both in all three engines).

## In the guest

```ts
import { connectGuest } from "@graview/guest";

const guest = connectGuest();
guest.subscribe((props) => render(props.node, props.acts));
const answer = await guest.act("mark-cooked", { recipeId: props.node.id });
if (!answer.ok) show(answer.message);   // the policy's own sentence
guest.navigate(id);
guest.autoSize();
```

In React, `useGuest()` from `@graview/guest/react` is the same connection:
`{ props, act, navigate, size }`, re-rendering on every push. The guest
entries import nothing of the framework, so a guest bundle carries none of it.

`GuestProps` is the plain-data half of `ViewProps` — `node`, `nodes`, the
`edges` among them, `label`, `fidelity`, `cardinality`, `mode`, `selected`,
`implicated`, `flagged` — and `acts`, the acts the viewer may run. A record
the viewer may not see is in none of them. Every record's `label` is
filled as the host labels it, and `theme` is the app's.

### What a frame guest reads, and its look

```ts
views.register("package", { cardinality: "many", fidelity: "full" },
  guestView({ url, name: "prices", reads: { kinds: ["offer"], edges: ["includes"] } }));
views.home(guestView({ url: frontUrl, name: "front", reads: { kinds: ["package"] } }));
```

A guest is handed what it is drawn over and the edges among those records.
With `reads` it is also handed every record of the kinds it reads and
every edge of the edges it reads between the records it holds, as the
viewer sees them (`readAcross`, the rule a worker view's manifest uses
too). A guest over packages that reads `offer` and `includes` gets each
package's offers, and an offer the viewer may not see is in none of it.
Drawn as the home (`views.home`), a guest is drawn over nothing and sees
what it reads: it is the routed home's body, and the landing over the scene.

Its props carry `theme`, a `GuestTheme`: the scheme, the accent, ground,
panel, ink, muted ink and edge colours, and the body and mono fonts, read
off the element the frame is drawn in. The scheme is the app's own (the
embed's `data-graview-scheme`), not the system's, and the host pushes
again when the app's toggle changes it. `mountGuestView` takes `reads`
and `theme` too.

## In a worker

Where a frame cannot be nested — a chat's widget, whose sandbox will not
frame another origin — the same guest runs in a classic Web Worker the host
starts from a `blob:` URL, and draws in the host's page from a component kit.

```ts
import { mountGuestWorker } from "@graview/guest/host/worker";

const guest = mountGuestWorker(element, { worker: { script }, view: "recipe-card", store, principal,
  onFailure: (reason) => showTheTierOneCard(reason) });   // refused, silent, or budget

views.register("recipe", { fidelity: "full", cardinality: "one" },
  guestView({ worker: { script }, name: "recipe-card" }));
```

`mountGuestWorker` starts the worker without `type: "module"`, which a
`blob:` URL in an opaque origin cannot start, from the script's text or a
URL it is given. It speaks the frame's protocol: one `guest-ready`, answered
with a fresh nonce and a MessageChannel; the props as the viewer sees
them; acts applied as the viewer, `via: "view:<name>"`, under the same
limits. A second ready from the same worker is dropped. Once it is ready,
the host sends a heartbeat over the port and the worker's runtime answers
it; a worker that goes `limits.silentMs` (5 000 by default) without an
answer — a guest spinning in `while (true)` — is terminated, and
the host is told `silent`. A guest that is busy but yields is kept. The
host also counts its own time drawing what the guest sends. Over any one
second it spends at most `limits.drawMs` (100 by default). Past it, the
rest of the batch is left undrawn, the worker is terminated, and the host
is told `slow`. What the guest draws
comes over the port as Remote DOM mutation records, and the host draws only
the kit (`GUEST_KIT`), with `createKitRenderer`. Both are
`@graview/guest/host/worker`, apart from the frame's host, so a page that
draws only frames loads none of it, and `guestView` fetches it only when it
draws a worker.

In the guest, `connectGuest` from `@graview/guest/worker` is the frame
guest's API with a `root` to draw into:

```ts
import { connectGuest } from "@graview/guest/worker";

const guest = connectGuest();
guest.subscribe((props) => {
  const card = document.createElement("gv-card");
  const title = document.createElement("gv-title");
  title.textContent = props.node?.label ?? "";
  const cook = document.createElement("gv-button");
  cook.textContent = "Cooked it";
  cook.addEventListener("press", () => guest.act("mark-cooked", { recipeId: props.node!.id }));
  card.append(title, cook);
  guest.root.replaceChildren(card);
});
```

The kit is one declaration for both sides: each component's host element,
typed properties, events and children. The worker's remote elements are made
from it, and the host draws from it alone. An element outside it, a property
or event it does not declare, a value of another type, and a link that is
not an absolute `https:` URL are not drawn, and `refused` says why. A link
opens with `rel="noopener noreferrer"` and no referrer, in a new tab unless
the kit says `target: "_self"`; a host that passes
`links: { origins: ["https://recipes.example"] }` draws a link only to one
of those origins, and any other with no `href`.

Before the guest runs, the worker entry hardens the worker's global: every
name outside `GUEST_GLOBALS` goes, from the global and every prototype on its
chain — the network, storage, channels, nested workers, importScripts,
`eval` and every function constructor — and what is left is frozen. A name
that will not go stops the worker before any guest code runs. `hardening`
says what was removed.

Build the guest with `buildGuestBundle` from `@graview/guest/build` (Node,
with esbuild installed): one strict classic script, the worker entry first
and the guest after it, with nothing to load at run time.

```ts
import { buildGuestBundle } from "@graview/guest/build";

const { script, sha256 } = await buildGuestBundle({ entry: "src/recipe-card.ts" });
```

A guest that writes `import()` or importScripts is refused at build, and
`checkGuestBundle` says the same of a script built elsewhere. Hardening holds
only for a bundle whose first module is the worker entry, so a host that
runs guests it did not build checks them, or better, builds them itself.

The worker entry carries Remote DOM (`@remote-dom/core` and its polyfill,
MIT, pinned); the frame guest and the host do not.

## A worker view on the open kit

A view that needs more than the kit's components — a card grid, a chart,
an animated ring — draws plain HTML, SVG and one stylesheet instead. What
keeps it safe is what it can reach, not what it can draw: it runs in the
same hardened classic worker, and the host draws what it says into a
shadow root inside a region of the host's own — `contain: layout paint
style`, `isolation: isolate`, `overflow: clip` — keeping only what the open
kit allows. The view is one plain script with no imports and no build;
the host puts the view's runtime in front of it.

```ts
import { mountWorkerView } from "@graview/guest/host/worker";

const view = mountWorkerView(element, { manifest, worker: { source }, store, principal,
  onFailure: (reason, detail) => showTheTierOneFace(reason, detail) });
```

In the worker, the view has one global, `graview`:

```js
graview.style(`.grid { display: grid; gap: 12px } .card { background: var(--graview-panel) }`);
graview.onProps((props) => graview.render(graview.html`
  <section class="grid">${props.nodes.map((n) => graview.html`<article class="card"><h3>${n.label}</h3></article>`)}</section>`));
graview.on("click", ".card", (event) => { /* … */ });
```

What may be drawn is one declaration, read by both sides: most of HTML's
sectioning, text, lists, tables, `details`, buttons, fields and `img`;
SVG's shapes, paths, text, gradients, clip paths, masks, markers and `use`
of `#id`; and CSS for layout, grid, flex, colour, type, transitions,
keyframes, media and container queries, with the app's theme tokens
(`--graview-*`) inherited, light or dark as the app is. The stylesheet,
every `style` attribute and every SVG paint are read with the CSS Syntax
tokenizer and parser — escapes decoded, comments gone — and written afresh
from what was kept: `url()` only as `url(#id)` on a paint, no `@import`,
`@font-face` or other at-rule but `@media`, `@supports`, `@container` and
`@keyframes`, only the functions on the list (no `image-set()`, `attr()`,
`cross-fade()`, `element()` …), `position` only static, relative or
absolute, and no selector that reaches out of the shadow tree (`:host`,
`::slotted`). An image is a `data:` image or a `blob:` of the page's own;
an SVG image in an `img` runs no script and loads nothing. No `<script>`,
`<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>`, `<style>`,
`<form>`, SVG `<image>` or `<foreignObject>`, no `src`, `href`, `srcset`,
`formaction` or `on*` attribute is drawn; what is not drawn is in
`refused`, with why. A view never speaks as the app's chrome. `<nav>`,
`<header>`, `<footer>`, `<aside>` and `<search>` are drawn as `<div>`, and
`<output>` as `<span>`. Each holds what it held and is marked
`data-graview-as`, and the view's selectors for those names are read as
that attribute. A `<section>` is never named, and `role` takes no landmark
or notice's role. `guest-sandbox --transport=open` serves a page with no
content security policy, tries every way out, and finds no request leaving
it in Chromium, WebKit or Firefox.

### A worker view is a place

A worker view says what it is and what it may touch in a manifest the host
enforces:

```ts
import { registerWorkerView, workerHome } from "@graview/guest/host/views";

const packages = {
  manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many",
    reads: { kinds: ["offer"], edges: ["includes"] }, acts: ["set-standing"] },
  worker: { source },
  author: "Made by Claude for Nick",
};
views: (schema, registry) => registerWorkerView(registry, packages),   // the embed's views
pages.surface("home", workerHome(frontPage));                         // a view of the home
```

It is handed the viewer's sight and nothing more, cut to the kind it
attaches to (the members the face hands it, or every one the viewer sees)
and the kinds and edges it reads: a record the viewer may not see is in
none of it, and a kind it did not ask to read is not handed to it however
visible. Every record's `label` is filled as the host labels it — for a
frame guest too. A titled view is a named place on the Graview face and
the pages face, by its title; whatever the registry drew for that kind
before is drawn if the view fails. With `attach: "home"`,
`registerWorkerView` makes it the home's own view (FR-81). That is the
routed home's body and the landing over the scene when it is at home, in
place of the home the app declared, which is drawn if the view fails.
`workerHome` makes it the routed face's whole home surface instead. Its props carry the app's look as a
`GuestTheme` — the scheme, the accent, ground, panel, ink, muted ink and
edge colours, and the body and mono fonts — read off the region it is
drawn in, and the host
pushes again when the app's own toggle changes the scheme, whatever the
system prefers. `checkManifest` says what in a manifest names a kind, an
edge or an act the app does not declare, and the host refuses to start
such a view (`onFailure` hears `manifest`).

### Writes that cannot leak

A view runs for every member with that member's sight, and its author is
not the member, so the danger is a view reading what this viewer may see
and writing it where somebody else may. An act must be named in the
manifest. Where the app's sight is total — no sight is declared, or every
kind is seen whole by everybody (`sightIsTotal`) — an act the view asks for
from its code applies with its arguments as given. Otherwise it applies
only from a press the host itself saw:

```html
<fieldset>
  <input name="summary" placeholder="What it is">
  <button data-act="set-summary" data-record="package:start">Say it</button>
</fieldset>
```

A trusted click on an element with `data-act` is judged and applied in the
click's own handler, before the view hears of it (it hears `pressed`). Its
arguments come only from the record the element is bound to (`data-record`,
one the view was shown), the manifest's constants for the act (`{ act,
as, constants }`), and the fields in the press's `fieldset` the host read
itself — each one the viewer's: its last change a trusted `input`, and
nothing the view wrote in it since. A field the view filled is the view's
until the viewer empties it; a `change` a browser raises when such a field
loses focus is not typing; a view that says back what a field shows, or
empties it, takes nothing away. Either way an act is applied as the viewer,
`via: "view:<name>"`, within the view's allowance, and undoable.

### Links stay in the app

A worker view links to a record or a named place of this app, and nowhere
else. The open kit draws no `href`, so `<a href="https://…">` is text;
`<a data-record="offer:coaching">` and `<a data-place="the-packages">` are
made links by the host — focusable, a link to assistive technology — and
followed by it on a press or Enter, to a record the viewer may see or a
place the app has. `graview.navigate("offer:coaching")` and
`graview.navigate({ place: "the-packages" })` are held to the same. The
props list the app's places (`places`, each with its slug and title). On
the Graview face a record is focused and chosen and a place is drawn; on
the pages face each goes to its own address — through `useGoTo` in
`@graview/react`, which the routed face provides. The kit's `gv-link`
keeps `links.origins`: it is the kit's one deliberate way out, to the
origins a host lists, and an open-kit view has none.

### Limits, and what is drawn in a view's place

The host caps a view's code (`maxSourceBytes`, 256 000 by default), the
nodes it draws (`maxNodes`, 5 000), the messages it sends (`messages` in
`messageWindowMs`, 120 a second) and the time it takes over each push of
what it is shown (`pushMs`, 1 000 ms: the view's listeners as its runtime
times them, and the wait for the runtime to say it drew, as the host times
it), beside the heartbeat's `silentMs`, and the page's own time drawing
what the view sends (`drawMs`, 100 ms of any second). Past any of them the worker is
terminated, the plain face of what the view was shown — its title and each
record by its label, drawn by the host — is drawn in the region, and
`onFailure` hears why: `source`, `nodes`, `flood`, `slow`, `silent`,
`error` (it threw before it drew), `refused` or `manifest`, with a sentence
saying it. A host draws its own in its place with `fallback`; the React
registrations draw whatever the registry drew for the kind before.

What is left: work a view schedules with timers between pushes is not
timed per push. A view that busies its own worker for just under
`silentMs`, answers the heartbeat, and does it again can hold a core of the
reader's machine for as long as it is shown. That is the worker's thread,
not the page's; the page stays responsive.

### A view with no build

A view is handed over as its plain source, `{ source }`: one script
against the `graview` global, with no imports, no bundler and no copy of
the protocol. The host puts the view's runtime in front of it — Remote
DOM's polyfill, the hardening, the channel and the global, which the host
holds as one classic script and fetches only when it first starts a view —
and runs both as one strict classic worker. A module worker is not an
option: a `blob:` one is refused in an opaque origin. The hardened worker
has no `eval`, no function constructor and no `importScripts`, so the one
way left to load code is `import()`, which is syntax: a source whose text
says `import` anywhere, even in a string or a comment, is refused before it
runs (`checkViewSource` says why), and so is one that exports. `{ script }`
still takes a whole worker script built against `@graview/guest/worker/view`.
How to write one — the manifest, what may be drawn, the theme's tokens, the
write rules, links and limits, with a list lens and a home worked through —
is the `graview-worker-view` skill (`graview skills install`).

### Run a view headless, and say what it drew

Before a view is applied, a host can run it once with no network and no
DOM, against one member's sight, and be told what it drew in the words
`describePlace` says a place in (`@graview/core/describe`): its headings,
text, figures and fields, and its lists with each record's title and what
its row or card says. Or it is told why the view will not do.

```ts
import { runWorkerViewHeadless } from "@graview/guest/headless";

const result = await runWorkerViewHeadless({ manifest, source, store, principal, run });
if (result.ok) say(result.description.text);       // "The packages (/places/the-packages) — as partner …"
else say(result.reason, result.detail);            // "act": It asks for the act "buy", which its manifest does not name.
```

The reasons are the page's (`source`, `manifest`, `error`, `nodes`,
`flood`, `slow`, `refused`) and two of a headless run's own: `act`, an act
asked for from the view's code or bound to a press (`data-act`) that its
manifest does not name, and `isolate`, the host's isolate could not run it.
Nothing is applied: an act the view asks for is written down in the
transcript and answered with a refusal.

A view never runs in the host's own context. The host supplies the
isolate: `run` is handed one script and one JSON string (`HeadlessPayload`),
loads the script into an isolate of its choosing, calls the global it
leaves (`graviewHeadless`) with the string, and hands back the string it
resolves with. Nothing but text crosses. There is no default, and without
a `run` the helper throws. The script is the headless runtime, then the
view. It makes the isolate a worker's before the view is read: the same
`graview` global over a transcript, a console that writes to it, timers
that never fire, and everything outside the worker's allowlist taken from
the global. Then the view's top line runs and it is pushed what it is
shown, once. What it sent is judged again in the host's context, from the
transcript alone, by the open kit's own renderer drawing into a tree of
plain objects (`drawTranscript`, `describeDrawing`), so the isolate's word
is not taken for what the view drew.

`nodeIsolate` from `@graview/guest/headless/node` is a `run` for Node: a
worker thread with a heap ceiling and a context made from nothing (no
`process`, `require`, `fetch` or timers; no code from strings), with a
deadline that covers the microtasks the view queues. In workerd, the
script is one module of a worker of its own with no outbound network, and
the host's module, loaded first, keeps `Response` to answer with:

```js
// before.js
const Made = Response; export const answer = (text) => new Made(text);
// host.js
import { answer } from "./before.js"; import "./view.js";   // view.js is payload.script
const run = globalThis.graviewHeadless;
export default { async fetch(request) { return answer(await run(await request.text())); } };
```

`graview view check view.js --app app.js --manifest manifest.json --seed
seed.json --roles partner` does the same from a terminal, with
`nodeIsolate`.
