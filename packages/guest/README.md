# @graview/guest

A view somebody else wrote — a recipe card, a bespoke dashboard, React or
plain script — drawn in an iframe that can see only what the viewer may see
and can only ask. The host pushes the view's props as the viewer sees them;
the guest asks for an act by name, and the host applies it as the viewer, so
the policy refuses on the guest's behalf exactly as it would refuse a click.
The rail says the act came through the view.

## In the host

```ts
import { guestView } from "@graview/guest/host";

views.register("recipe", { fidelity: "full", cardinality: "one" },
  guestView({ url: "https://cards.example/recipe.html", name: "recipe-card" }));

// Or without React, into any element (`guestView` fetches this as it is first drawn):
import { mountGuestView } from "@graview/guest/host/frame";
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

The frame says when the guest has drawn, so a page that says it has drawn
(the embed's `data-graview-drawn`) can wait for it: `data-guest-view-drawn`
once the guest has said it is ready, been handed what it shows (and the
pictures it asked for) and asked for its height — or stayed quiet for a
moment after, if it never asks — and `data-guest-view-failed="silent"` when
it does not say it is ready in `limits.readyMs` (eight seconds by default).
It is `aria-busy` until one or the other; a guest that says it is ready
after all is drawn then.

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
the viewer may not see is in none of them. A record is plain data: its
`id`, `kind` and `label`, and each of its fields on it by name — a
deliverable's draft is `node.draft`, its status `node.status` — with no
`fields` key. A view of one record finds it in `node`; `nodes` are the
members of a view of many, and the records a view reads beyond its own.
Every record's `label` is filled as the host labels it, and `theme` and
`places` are the app's.

### What a frame guest reads, its look, and its place

```ts
views.register("package", { cardinality: "many", fidelity: "full" },
  guestView({ url, name: "prices", title: "The price sheet", reads: { kinds: ["offer"], edges: ["includes"] } }),
  { title: "The price sheet" });
views.home(guestView({ url: frontUrl, name: "front", reads: { kinds: ["package"] } }));
```

A guest is handed what it is drawn over and the edges among those records.
With `reads` it is also handed every record of the kinds it reads and
every edge of the edges it reads between the records it holds, as the
viewer sees them (`readAcross`, the rule a worker view's manifest uses
too). A guest over packages that reads `offer` and `includes` gets each
package's offers, and an offer the viewer may not see is in none of it.
Drawn as the home (`views.home`), a guest is drawn over nothing and sees
what it reads: it is the routed home's body, the page the app opens on (FR-136).

Its props carry `theme`, a `GuestTheme`: the scheme, the accent, ground,
panel, ink, muted ink and edge colors, the body, display and mono fonts
and the radius, read off the element the frame is drawn in; and the brand's
`name` and `logo` (FR-127). The logo is a `data:` image the host made from
the brand's inline SVG, or from an address on the page's own origin it
fetched (another origin's logo is not handed), so the guest loads nothing;
its policy needs `img-src data:` to show it. The scheme is the app's own
(the embed's `data-graview-scheme`), not the system's, and the host pushes
again when the app's toggle or brand changes. `mountGuestView` takes
`reads`, `theme`, `brand` and `places` too.

`title` names the frame for assistive technology. Registered with the same
title, the guest is a place on both faces: listed by `placesOf`, at
`/places/the-price-sheet` on the routed face and `#view=the-price-sheet` in
the scene. `props.places` lists the app's places, and
`guest.navigate({ place: "the-packages" })` goes to one.

### One client, served or inlined

`@graview/guest/client.js` is the frame guest's client as one prebuilt
classic script (2.4 kB). It leaves one global, `GraviewGuest`, and
`GraviewGuest.connect()` is `connectGuest()`. A host serves it at a path of
its own, or inlines its text where a frame's policy allows inline script
alone, as Graview Cloud serves an uploaded view (`script-src
'unsafe-inline'`). `GUEST_CLIENT` from `@graview/guest/client` is that
text, and `GUEST_CLIENT_SHA256` its hash for a policy that names it.

```html
<main id="app"></main>
<script>/* GUEST_CLIENT */</script>
<script>
  const guest = GraviewGuest.connect();
  guest.subscribe((props) => {
    document.body.style.background = props.theme.panel;
    app.replaceChildren(...props.nodes.map((node) => Object.assign(document.createElement("p"), { textContent: node.label })));
    guest.size(document.documentElement.scrollHeight);
  });
</script>
```

How to write one, with a worked example, is the `graview-embed` skill.
`guest-sandbox --transport=client` serves a guest of a few lines under that
policy and finds it renders, acts, navigates, resizes and follows the
app's toggle in Chromium, WebKit and Firefox.

## In a worker

Where a frame cannot be nested — a chat's widget, whose sandbox will not
frame another origin — the same guest runs in a classic Web Worker the host
starts from a `blob:` URL, and draws in the host's page from a component kit.

```ts
import { mountGuestWorker } from "@graview/guest/host/worker";

const guest = mountGuestWorker(element, { worker: { script }, view: "recipe-card", store, principal,
  onFailure: (reason, detail) => showTheTierOneCard(reason) });   // start, silent, slow or budget

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
the host is told `silent`. A worker that never says ready — the page
refused it, it failed before its first line ran, or it was not ready in
`limits.readyMs` — is `start` (see "What the host page allows"). A guest that is busy but yields is kept. The
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
an animated ring — draws plain HTML, SVG and stylesheets instead. What
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

A delegated listener is handed `event.element`, the element its selector
matched at or above what was pressed (`event.target`), so it reads that
element's `data-*`:

```js
graview.on("click", "button[data-more]", (event) => toggle(event.element.getAttribute("data-more")));
```

To go somewhere, draw `<a data-record>` or `<a data-place>` rather than
hearing a click and navigating; to do something, a `<button>`. The region
resets a button and a link the host made to the words around them at no
specificity, so a view's own class always wins. A control the view hears
itself — `role="button"`, `"checkbox"`, `"switch"` or `"tab"`,
`aria-pressed`, `aria-expanded` — is given the keyboard where it has none,
and Enter or Space on it is told to the view as the key and then a
`click`. Whatever has the keyboard shows the host's ring, which a view
restyles with `--graview-focus-color`, `--graview-focus-width` and
`--graview-focus-offset` and cannot take away with `outline: none`;
`class="graview-sr"` is words for assistive technology alone; an `<svg>`
with no role, `aria-label` or `<title>` is hidden from it; and an element
with a `data-key` keeps the keyboard when the view draws it again
elsewhere.

Each `graview.style(css)` adds a sheet after the ones before it — the
app's shared design system first, then the view's own — and every one is
drawn, in that order, on the page and in a headless run alike. Each is
judged on its own, so one left open swallows nothing after it, and all of
them share one budget (64 000 characters); a sheet given again is the one
already there, so a view that styles on every push adds nothing.

The worker's elements are Remote DOM's polyfill, which has no `closest`,
`matches` or `dataset`; calling one throws a sentence that names
`event.element` as the way.

What may be drawn is one declaration, read by both sides: most of HTML's
sectioning, text, lists, tables, `details`, buttons, fields and `img`;
SVG's shapes, paths, text, gradients, clip paths, masks, markers and `use`
of `#id`; and CSS for layout, grid, flex, color, type, transitions,
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
`<form>`, SVG `<image>` or `<foreignObject>`, no `src`, `srcset`,
`formaction` or `on*` attribute, and no `href` but a link out to an address
the view was handed (below), is drawn; what is not drawn is in
`refused`, with why. A view never speaks as the app's chrome. `<nav>`,
`<header>`, `<footer>`, `<aside>` and `<search>` are drawn as `<div>`, and
`<output>` as `<span>`. Each holds what it held and is marked
`data-graview-as`, and the view's selectors for those names are read as
that attribute. A `<section>` is never named, and `role` takes no landmark
or notice's role. Every other role and every `aria-*` state and property
is kept, so a view builds the controls a person reaches by keyboard and
assistive technology — `<span role="checkbox" aria-checked="true"
tabindex="0">`, a `switch`, `aria-pressed`, `aria-expanded` with
`aria-controls` naming an id it drew, tabs, a radio group, a `slider` — and
a headless run draws them element for element as the page does, refusing
what the page refuses. `guest-sandbox --transport=open` serves a page with no
content security policy, tries every way out, and finds no request leaving
it in Chromium, WebKit or Firefox; and it reads a view's own controls back
from each engine's accessibility tree with their states.

### A link out goes only where the view was handed

`<a href="${record.url}">` is drawn where its address is one a record the
view was shown holds, as the record holds it — an `https:` page, a
`mailto:`, a `tel:` — and, where the host lists origins for links
(`links: { origins: ["https://nvd.nist.gov"] }` on `mountWorkerView`, a
registered view's definition and a headless run), any `https:` address on
one of them. The host draws it to open in a new tab, `rel="noopener
noreferrer"` with no referrer, so the page is never navigated, the tab it
opens has no hold on it and is told nothing of it, and it marks the link
with an arrow and "(opens in a new tab)" in its accessible name. Anything
else — an address the view built, `javascript:`, `data:`, `http:` — is drawn
with no `href` and said once, in the view's console and to the host's
problems, as a headless run says it.

Why handed, and not any `https:` address: a view reads what the seat sees
and can write any string, so a link it made is a way out —
`https://elsewhere.example/?d=` and whatever it read, one press away,
however the link looks. An address the view was handed carries nothing the
view chose but which of them it links. A list of origins is the host's
choice for the place, as it is for images; a manifest cannot widen it,
since the manifest is the view author's own word.

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

A host with many views need not fetch every one's code before the page
draws. `worker` may be a function answering the code — `worker: () =>
fetch(sourceUrl).then((r) => r.text()).then((source) => ({ source }))` —
asked only when the view is first drawn, beside the worker's host, once
however often it is drawn and again after it rejected. The manifest is what
registers the view, as a place and in every menu, so only the places a
person opens fetch their code. What arrives is judged as handed code is;
code that never arrives is refused `source` ("Its code did not arrive: …")
and the kind's own face is drawn.

It is handed the viewer's sight and nothing more, cut to the kind it
attaches to (the members the face hands it, or every one the viewer sees)
and the kinds and edges it reads: a record the viewer may not see is in
none of it, and a kind it did not ask to read is not handed to it however
visible. Every record's `label` is filled as the host labels it — for a
frame guest too. A titled view is a named place on the Graview face and
the pages face, by its title; whatever the registry drew for that kind
before is drawn if the view fails. A view of one record (`cardinality:
"one"`) is drawn above the record's own fields, which stay editable: on
the scene the record drawn at full is the view and then the record's
fields, each editable where an act writes it; on Pages the record's page
is its heading, the view, then its facts and what can be done (FR-149).
With `replaces: "page"` in its manifest it is drawn alone in their place —
on the scene the view only, on Pages the view under the heading with what
is wrong and what has happened — and the record is then changed only
through what the view offers. A view of many (`cardinality: "many"`) with
`replaces: "page"` is its kind's list page (FR-203): `/<plural>` draws it
under the list's heading in place of the list, and the kind's own face if
it fails; left out, the list page is the app's own, and a titled view of
many is drawn at its own place only. `checkManifest` refuses `replaces` on
the home's view. With `attach: "home"`,
`registerWorkerView` makes it the home's own view (FR-81). That is the
routed home's body — the page the app opens on, full width on a desk as on
a phone (FR-136) — in place of the home the app declared, which is drawn if the view fails.
`workerHome` makes it the routed face's whole home surface instead. Its props carry the app's look as a
`GuestTheme` — the scheme, the accent, ground, panel, ink, muted ink and
edge colors, the body, display and mono fonts and the radius — read off
the region it is drawn in, with the brand's `name` and `logo` (FR-127):
a `blob:` URL of the host's page the host made from the logo, or a
`data:` image where the page's policy refuses `blob:` images (ChatGPT's
does), so `<img src="${props.theme.logo}">` loads nothing. The host
pushes again when the app's own toggle changes the scheme, whatever the
system prefers, and when the brand changes, revoking the last logo's URL. `checkManifest` says what in a manifest names a kind, an
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

A view cannot fill a field, so to offer a record's own text to change —
a three-thousand-character draft — it asks the host to (FR-150):

```html
<fieldset data-record="deliverable:email">
  <textarea name="draft" data-prefill="draft"></textarea>
  <button data-act="set-draft">Save the draft</button>
</fieldset>
```

After each batch the view draws, the host fills an empty `input` or
`textarea` whose `data-prefill` and `name` name the same field with that
field of its bound record (`data-record` on it or around it, else the one
record the acts in its `fieldset` are bound to), read through the viewer's
sight, whole and with its line breaks — when the record is one the view
was shown, and an act in the `fieldset` is named in the manifest, is done
to that record, takes the field, writes it (its `writes`, or, declaring none, an argument
named like the field), writes no other record's fields, and may be run
there by this viewer (`store.permits`). Otherwise the field stays empty;
a seat that may not write the field is never handed it to edit. The value
filled is the viewer's, as if typed, and what they type after it is
theirs; but a press carries it only to an act that writes that field of
that record, and any other press carrying it is refused
`untyped`. A field the view drew words into, or writes into after the
host filled it, is the view's, as ever. Nothing leaks by it: the value is
a field of a record the view was already shown, and it can only be saved
back where it came from, by an act the viewer may run there.

A field can save itself as the viewer types, with no button (FR-191): it
carries its act, and says when it saves.

```html
<fieldset data-record="call:todd">
  <textarea name="notes" data-prefill="notes" data-act="save-notes"
            data-save="input" data-debounce="1500"></textarea>
</fieldset>
```

With `data-save="input"` the viewer's typing (a trusted `input`) saves it
once they pause for `data-debounce` milliseconds — 1 000 when it is left
out, held to 250–10 000 — and leaving the field (its trusted `change`)
saves at once what was still waiting, as does the view going away;
`data-save="change"` saves on the `change` alone. A save is a press in
every way but the click: the act is the field's own `data-act`, its record
and its `fieldset`'s fields are read as a press reads them, and it is held
to the same rules. A click into the field is not a press. The view's code
holds nothing and can start nothing; it hears what became of each act a
press or a save asked for as an `acted` event on the bound element —
`graview.on("acted", "textarea", (event) => …)`, with `event.pressed`
holding `as`, `ok`, and `reason` and `message` when it was refused — so it
can say "Saving…" on `input` and "Saved" on `acted`. A headless run says
when a field's `data-save` would save nothing: no `data-act`, no `name`,
outside a `fieldset` bound to a record, or a `data-debounce` it does not
read.

### Links stay in the app

A worker view links to a record or a named place of this app, or out to an
address it was handed, and nowhere else.
`<a data-record="offer:coaching">` and `<a data-place="the-packages">` are
made links by the host — focusable, a link to assistive technology — and
followed by it on a press or Enter, to a record the viewer may see or a
place the app has. `graview.navigate("offer:coaching")` and
`graview.navigate({ place: "the-packages" })` are held to the same. A bare
string is a record the viewer may see first, then a place by that slug, so
`graview.navigate("the-packages")` goes to the place. The Scene and the
home are places by name too (FR-235): `data-place="overview"` goes to the
Scene's overview and `data-place="home"` to the front page, on either
face; a kind's list by its slug. What a view may name is one vocabulary,
`placeNamesOf` on `@graview/core/navigate`, read alike by the headless
check and the page. A destination that
is neither goes nowhere and says why — in the view's console, and to the
host's problems (the onProblem option on `mountWorkerView` and on a registered view's
definition) — naming the places there are. The
props list the app's places (`places`, each with its slug and title). On
the Graview face a record is focused and chosen and a place is drawn; on
the pages face each goes to its own address — through `useGoTo` in
`@graview/react`, which the routed face provides — and an `<a data-record>`
or `<a data-place>` carries that address as its `href` (`GoTo.href`, or
the address option on `mountWorkerView`): a plain click, a tap and Enter are followed
in the app, and a click with Cmd, Ctrl or Shift, or a middle click, opens
it as the browser opens any link. Where there is no address (the scene),
the host gives the link the keyboard and a link's role instead. The kit's `gv-link`
keeps `links.origins`: it is the kit's one deliberate way out, to the
origins a host lists, and an open-kit view has none.

### A record's video, and the full-screen viewer

A worker view may not draw `<video>` (it fetches) or cover the app
(`position: fixed`, the top layer), and is never handed the host's path to
a file. So it names what it wants and the host draws it, from the records
the view was last shown, for a view whose manifest says `pictures`:

```html
<graview-video data-record="moment:dusk" data-field="clip"></graview-video>
<button data-lightbox data-record="moment:dusk" data-field="photos" data-index="1">See it full screen</button>
```

In a `<graview-video>` (the open kit's one element the host draws for a
view: it names a file and holds nothing) the host plays that record's
video in a shadow root of its own — the poster first, the browser's own
controls, `preload="metadata"`, captions where the value carries them,
sized from the value — fetched where the host serves files (`file`, else
the page's `files.src`). The view's stylesheet sizes the box and reaches
nothing inside it, and the view hears nothing pressed there. A viewer's
own press (a click, or Enter or Space on what is not a button) on a
`data-lightbox` element opens the host's full-screen viewer for that
picture or video: a modal dialog over the app, closed by Escape or its
Close button, with the keyboard given back to what opened it. The view's
code cannot open it. A record the view was not shown, a field that holds
no such file, or a view without `pictures` draws nothing and says why, in
the view's console and to the host's problems. A video is handed to the
view as its facts (`name`, `type`, `bytes`, `width`, `height`, `caption`,
`duration`, and `poster: true` where it has one), never an address; a
headless run says a placed video as "The waves at dusk, a 45-second
video". A frame guest places none: its frame is another origin.

A video plays as a hero background (Roadmap f-video-hero) where the view
asks for one:

```html
<graview-video autoplay cover data-record="moment:dusk" data-field="clip"></graview-video>
```

`autoplay` is muted, looping, inline and without controls — autoplay
without muted never plays, so the one word means all of it — and `cover`
fills the box the view sized (`object-fit: cover`; the view's stylesheet
rounds and clips the box). Where the person asked for less motion
(`prefers-reduced-motion: reduce`) the background stands still at its
poster, fetching only its metadata, and is let go when they stop asking.
The source, the poster and the controls stay the host's: `src`, `poster`,
`controls`, `loop` and `muted` on a `<graview-video>` are refused. A
headless run's description carries `videos`, one per placed
`<graview-video>` — the record and field, what it shows, its `source`
(the media type), its `duration`, whether it has a `poster`, `autoplay`
and `cover`, and `playable`: a source every browser plays (MP4, WebM or
Ogg, what a host's upload transcodes to) with a poster to stand at, with
`why` when it is not — so an agent confirms a hero plays without opening
a browser; `placeText` says each in one line under "Videos:".

### Files a person drops on it

A worker view takes files a person drops on what it drew (FR-193). Its
manifest says which fields files become, and it marks the element:

```html
<!-- manifest: accepts: [{ kind: "moment", field: "photo" }, { kind: "moment", field: "clip" }] -->
<section data-drop="moment" data-drop-connect="takenOn:day:saturday">Saturday</section>
```

The host owns the rest. The element is a drop target only where this seat
may make that kind (and link it to the record `data-drop-connect` names,
`<relation>:<record id>`, one the view was shown) and the page's host's
`files` take what the fields hold; anywhere else it is no target, and a
drop there is the browser's. While files are dragged over it the host
draws it with an outline of its own and says what dropping does in a
status of its own; on a coarse pointer the same element is a tap that
opens the picker, asking for what the fields take, and Enter or Space on
it does the same. Each file goes to the field its type fits (a picture to
an image field, a video to a video field, else a file field), is held to
the kinds and the size the host's files take, and is stored through `files.upload`;
what was refused is said, a sentence a file. `data-drop-field` narrows a
target to one of its kind's accepted fields.

A view that does not hear `drop` gets a record of the kind per file, its
file on its field, linked as `data-drop-connect` says — by an act on the
dropped-on record that makes one linked, where the app has one, else the
act that makes the kind and the relation's connect, naming the record
just made with `{ $made: n }` — all in one change one undo takes back. A
view that hears it is told once, and makes what it will:

```js
graview.on("drop", "[data-drop]", (event) => {
  // event.files: [{ href, name, type, bytes, width, height, poster, duration, at, field }]; event.refused: sentences.
  graview.act("add-moment-to-day", event.files.map((file) => ({ id: "day:saturday", [file.field]: file })));
});
```

`graview.act(name, [args, …])` runs several of one act as one change. An
act's argument takes a file only as the host handed it — in a drop, or on
a record the view was shown — and it goes as the host kept it; any other
`href` is refused `malformed`. Where sight is not total, an act from the
view's code applies only from a press, as ever, except one whose every
argument is a drop's file, the record the drop was bound to (its
`data-drop-connect`, or the `data-record` it was drawn in), or a record
the same change makes — and each dropped file goes in one act, once. A
headless run says a
`data-drop` its manifest does not accept, and a `data-drop-connect` that
names no record the view was shown.

Every event a view hears is `{ type, target, element }` and what that
event carries: `value` and `checked` (`input`, `change`), `key`
(`keydown`), `pressed` (a press on `data-act`, and `acted`), `files` and
`refused` (`drop`), and a gesture's fields (`wheel`, `drag`, `pinch`).

### A wheel, a drag and a pinch

A view whose manifest says `gestures: true` hears a wheel, a drag and a
pinch over what it listens on — a map it pans and zooms, a timeline it
scrubs:

```js
graview.on("wheel", ".map", (e) => zoom(e.x, e.y, Math.exp(-e.deltaY / 500)));
graview.on("pinch", ".map", (e) => zoom(e.x, e.y, e.scale));
graview.on("drag", ".map", (e) => e.phase !== "start" && pan(e.dx, e.dy));
```

Each carries where the pointer is, `x` and `y` in CSS pixels from the top
left of the element the selector matched, and that element's `width` and
`height`, since a worker has no layout to ask. A `wheel` has `deltaX`,
`deltaY`, `deltaMode`, `ctrlKey` and `metaKey`. A `drag` — `pointerdown`,
`pointermove`, `pointerup` on what it listens on, the pointer captured
there — has `phase` (`start`, `move`, `end`), `pointerId`, `button`,
`pressure`, and `dx` and `dy` since the view last heard of that pointer. A
`pinch` — Safari's `gesturestart`, `gesturechange` and `gestureend`, or a
trackpad's pinch, which every engine says as a wheel with Control held —
has `phase` (`start`, `change`, `end`), `scale`, the factor since the view
last heard, and `rotation` in degrees. A Control-wheel goes as a `pinch`
where the view listens for one there, and as a `wheel` with `ctrlKey`
where it does not.

The host sends at most one of each an animation frame, the deltas between
summed (a pinch's scale multiplied); a drag's start and end go at once. It
takes a wheel and a gesture from the page (`preventDefault`) only over an
element the view listens on for it, so the page scrolls and zooms
everywhere else, and a view that did not opt in changes nothing about the
page at all. A drag takes nothing: a view that drags on a phone says
`touch-action: none` in its stylesheet. The runtime tells the host where
it listens (`{ type: "gestures", bound: [{ event, selector }] }`) whenever
that moves; the host fetches its gestures only for a view that opted in
and listens for one. A view that listens for a gesture without the flag is
told in its console, and its headless run says so, as it says a flag with
nothing to hear.

### What the host page allows

A worker guest, on the kit or the open kit, starts from a `blob:` URL the
host makes of its script. The page's Content-Security-Policy has to allow
that, and an open-kit view's stylesheet:

```
worker-src blob:; style-src 'unsafe-inline'
```

With no `worker-src`, the browser reads `script-src` instead (and
`default-src` with neither), so a page that says `script-src 'self'` and
no `worker-src` refuses every view. Nothing else is needed for the worker:
it runs none of the page's scripts and has no network to allow. An
open-kit view's stylesheet is a `<style>` in its region's shadow root, and
the kit's CSS one in the page's head, hence `style-src 'unsafe-inline'`.
An image a view draws is a `data:` image or a `blob:` of the page's own,
so `img-src data: blob:` if views draw images.

A page that refuses the worker is told so. Chromium and WebKit throw from
`new Worker` and Firefox fires `error` on it. Either way `onFailure` hears
`start` once for each view, with a sentence naming the directive (`it needs
worker-src blob:`). The plain face is drawn in the view's place, and the
page's console is told once however many views it refuses. `start` is also
a worker that failed before it said ready, or was not ready in
`limits.readyMs` (5 000 by default). Each runtime says ready before a line
of the view runs, so a worker with no ready never started. `silent` is a
worker that said ready and then stopped answering. `registerWorkerView`
takes `onFailure` too, for a host that reports it.

A host that will not allow `blob:` serves each view's whole script from
its own origin under `worker-src 'self'`, and passes `worker: { url }`:

```ts
import { checkViewSource, viewScript } from "@graview/guest/host/views";

// On the server: the runtime, then the view, as the host would have made it.
if (checkViewSource(source).length === 0) serve(`/views/${name}.js`, await viewScript(source));
// On the page:
mountWorkerView(element, { manifest, worker: { url: `/views/${name}.js` }, store, principal });
```

The server checks the source then, since the page never holds its text,
and `maxSourceBytes` is the server's to keep. A kit guest takes
`worker: { url }` the same way. `guest-sandbox --transport=limits` serves
all three pages in Chromium, WebKit and Firefox: the policy above draws, a
page without it reports `start` once a view, and the served script draws
under `worker-src 'self'`.

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
`error` (it threw before it drew), `start` (it never started) or
`manifest`, with a sentence saying it, once. A host draws its own in its place with `fallback`; the React
registrations draw whatever the registry drew for the kind before.

The time budgets fit the device. `pushMs` and `drawMs` are what a fast
device is held to: the page measures how long its first view's worker took
to start — from `new Worker` to its runtime's ready, which is the device
making a thread and parsing and running the runtime — once, and keeps it.
Every view on the page is given its base times that pace: 1 for a start of
60 ms or under (a laptop keeps today's guard), rising to a ceiling of 4 for a
start of 240 ms or more, so a car's browser that draws a home view in two
seconds keeps it where it fell back before. A host's own numbers scale the
same way and never past four times; the counts — `messages`, `maxNodes`,
`maxSourceBytes` — never scale, so a flood is a flood on any device. The
sentence a stopped view is given names the budget it was actually held to
("It took longer than 2,400 ms…"), `pace` on the mounted view says the
page's pace once its worker is ready, and the page keeps whatever it shows —
the drawing before, or nothing — until the view draws or that budget runs
out; nothing is drawn in its place and then swapped. The headless runner's
`pushMs` is the server's and stays fixed. A start the network slowed —
`worker: { url }` answered late — reads as a slow device too; a view on a
slow link gets a slow device's time, and no more of anything else.

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
`flood`, `slow`; never the page's `start`, as nothing is started in a
worker) and three of a headless run's own: `refused`, the isolate could
not be hardened or something called the script's entry before the host
did; `act`, an act asked for from the view's code or bound to a press
(`data-act`) that its manifest does not name; and `isolate`, the host's
isolate could not run it.
Nothing is applied: an act the view asks for is written down in the
transcript and answered with a refusal.

Hand a run what the live page is handed, so it judges images as the page
does: `images` (the `https:` origins listed), `asset` (where the app's own
images live: the path `add_image` answers is drawn, and so is that path
under the app's base or by `origin`'s address for it) and `origin` (the
page's origin). Nothing is loaded in a run. A view whose manifest asks for
`pictures` is handed each picture with a stand-in `src`, a blank image, so
its `<img>` is drawn and judged as it will be once the page has the bytes.
The page draws a picture it handed at any size, as handed; one it would
leave out before fetching it — heavier than the host fetches, or past the
view's budget for its pictures, as `limits` says them — comes with
no `src` and the page's sentence in `left`, said among the problems at
`pictures` (FR-192).

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

### Audit what a view drew

`auditView(root)` from `@graview/guest/audit` holds a drawn view to what a
person on a keyboard or with a screen reader meets, and says each problem
as a repair: its rule, its WCAG 2.2 criterion, how bad, where (a selector
from the nearest `data-key`), a one-line fix, and `automatic` when the
framework is the one to fix it rather than the view.

```ts
import { auditView } from "@graview/guest/audit";

const audit = auditView(region.shadowRoot, { clicked: ["[data-more]"] });
for (const one of audit.problems) say(`${one.rule} (WCAG ${one.wcag}) at ${one.at}: ${one.fix}`);
say(audit.skipped);                                  // what did not run here, and why
```

It is judged as the host draws it: a link, a press and a control the view
drew itself take the keyboard on a page, so none is a problem, and a
`<div>` the view only hears a click on (`clicked`) is. The rules a drawing
alone shows run anywhere: `keyboard`, `role`, `name`, `toggle-state`,
`nested-interactive`, `img-alt`, `svg-name` and `scroll-region`. The ring
the keyboard shows (`focus-visible`) and text `contrast` run only where
the root is in a browser that lays it out, and say how many elements they
measured; elsewhere they are in `skipped`, never passed. A keyboard trap
needs keys pressed, which a harness's Tab walk does (`pnpm verify a11y`).
`AUDIT_RULES` lists each rule, its criterion and what it needs. On a page
a worker view is drawn in, `clicked` need not be handed: the view's runtime
tells its host where it hears a click, and the audit reads it off the
region.

A headless run audits what it drew when asked (`runWorkerViewHeadless({
…, audit: true })` answers with `audit`), with the elements its view
listens on for a click, and `graview view check … --audit` says it and
fails on what the view must fix. With `--browser` the command lays what
the view drew out in Chromium and runs every rule there: the ring, text
contrast, and Tab from before the view through it and out. It uses the
project's own Playwright, an optional peer of this package, and says what
to install when there is none.
