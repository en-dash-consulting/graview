# @graview/embed

Mount a declared Graview app into any element — a paragraph of a docs page, a
card on a dashboard, a preview in a builder — without the Shell, sized to the
element, themed within it, under one app bar.

```ts
import { mount } from "@graview/embed";

const handle = mount(document.querySelector("#garden")!, {
  app,                        // defineApp(...)
  seed,                       // the graph to open with, or nothing
  face: "graview",            // "scene" | "graview" | "pages" | "picture" — one named lens, no chrome: stop "#view=<place>"; leave it out and the app opens on its home view, else the scene
  stop: "#focus=plot-1",      // the scene's view state, as its URL fragment
  principal: { kind: "human", id: "june", roles: ["coordinator"] },
  bar: true,                  // the app bar over every face (the default)
});

handle.setPath("/plots");     // a place: the plots' list, at the element's width
handle.setPath("/places/overview"); // the scene, at its own address
handle.setStop("#overview=1&expand=kind:plot");
handle.unmount();
```

`<Embed {...options} />` is the same thing as a React component.

## The app bar

One bar stands over every face (FR-131). At the left, the app: its mark —
the brand's logo, when the document has one — and its name, said once, as
the page's heading (`heading`: `1` when the host's page is the app, `2`, the
default, inside an article, `false` when the host's own heading says it),
and the way home. Right after it, the switch between the app's two faces
(FR-137): "Scene" and "Pages", an icon and a word each (the icons alone on
a phone, the words their accessible names), two buttons whose
`aria-pressed` says which is drawn. Scene draws the scene under the bar;
Pages goes back to the page the reader was on. A declaration may call them
something else (`pages: { scene: "The farm", pages: "Lists" }`); the
scene's address is `/places/overview` whatever it is called. Then, on
Pages, the place you are on as one control — its name and a chevron — that
opens every place the app has (FR-138): the home first, then the Lists
(one per kind) and the Pictures (each named lens, and how the kinds
connect), each with its mark, a long name wrapped. Every place is two
presses away, Escape gives the keyboard back to the control, and the bar
is one row of 48 px however many places there are; on a phone the place
control is the page's first line, under the bar. At the right, three tools
of one size: Find (inline; ⌘K or Ctrl+K on a desk, a magnifier that opens
the box on a phone), the standing (a dot in the tone of the rules, a number
only when one is broken, opening what is broken; its name says "Everything
is in order" otherwise), and the person (an avatar whose menu holds who is
signed in, the seats, the host's own actions and, for whoever keeps the
app, the installation and the studio). `bar: false` draws none of it, for a
host whose own page already says all of that.

A HOME VIEW IS THE FRONT PAGE (FR-136). An app with a home view — the
declaration's `views.home`, or a worker view attached to `"home"` — opens
on Pages at its home, full width under the bar, on a desk as on a phone,
when the host names no face; under address routing it does so at the bare
address whatever face the host names. Nothing floats over the scene. A
declaration that names another first place (`pages.first`) opens there.

## What a page loads first

The frame — the element's region, its theme, the app bar, the provider — is
on the page when `mount` returns. Each face is a chunk of its own, fetched
the first time it is drawn: a page that opens on the pages never loads the
scene, one that opens on the scene never loads the router, and the
framework's own cards, rows and record pages come with whichever face
draws them first. Until a face's chunk arrives its box stands empty
(`aria-busy`), and `handle.drawn()` resolves once the face asked for is on
the page — after `mount`, and after every change of face.

A host that knows its face before it mounts starts that chunk at once,
beside its own requests, and an embed mounted once it is here draws it in
the first commit:

```ts
import { mount, preload } from "@graview/embed";

const face = innerWidth < 768 ? "pages" : "graview";
const faceReady = preload(face);            // with no face named, every face
const app = await fetchAndCompile();        // the host's own round trips, meanwhile
await faceReady;
const handle = mount(root, { app, face });  // drawn in this commit
```

What this asks of the framework, and what it adds: the theme scopes to the
element (`themeBaseCss(scheme, brand, { scope })`, and the blocks a view is
drawn with, `viewsCss`, and the scene's own rules, `sceneCss`, drawn by the
face that needs them beside it) rather than the document, every
rule of it held inside that element, so nothing of the host's is restyled; the
panes size against the picture's own box (`cqh`) rather than the viewport;
the routed face runs on a memory router, so the host page's address is never
touched (unless the host's page is the app: see below); the brand's fonts are fetched by the embed rather than assumed. The page's icon is
the host's: only a host whose page is the app passes `favicon: true` to wear
the brand's (FR-124), and an app that prefers dark is drawn dark until the host
stamps a scheme of its own. The
store is in memory and starts from the seed on every mount, unless the host
hands it one.

## When the page is the app: the address bar

A host whose whole page is the app — Graview Cloud's hosted app is one —
hands the routed face the address bar, so a place, a record and the home can
be linked, reloaded and shared:

```ts
const handle = mount(root, {
  app, store,
  face: innerWidth < 768 ? "pages" : "graview",  // where a bare address opens
  routing: "address",                            // the default is "memory"
  basePath: "/apps/a1/",                          // where the app is served; "/" by default
});
```

The host answers every address under the base with the same page. The
address then says which face is drawn and where on it, as the whole-page
Shell spells it:

| Address | Drawn |
|---|---|
| `/apps/a1/places/the-board`, `/apps/a1/tasks/t1` | the routed face, at that page |
| `/apps/a1/places/overview#focus=t1`, `/apps/a1/places/overview#overview=1` | the scene, at that stop (the Graview at altitude) |
| `/apps/a1#focus=t1` | the scene too — a link written before the scene had an address — tidied on arrival to the scene's address |
| `/apps/a1` | the routed face's home; on arrival, the home when the app has a home view, else the host's `face` (the Graview or the scene land on the scene's address) |

Each page the routed face opens is pushed, and Back returns. The scene
keeps its stop in the fragment the way the Shell does: a step is pushed,
moving the furniture replaces. The switch and the place list push the
address of where they go, the scene's included, so Back undoes it. A reload stays where it
was. `faceAtAddress(options)`
is the face an address opens on, for a host that renders `<Embed>` itself.
`placesOf(app)` gives each place's `address` within the app, and
`addressOf(place, { basePath })` from `@graview/core` gives it under the
base, spelled as the face's own links are (`pathWithin` reads one back).

`routing: "memory"`, the default, is for somebody else's page: it never
writes `history` and leaves `location` as it was. A host that keeps its
own history stays on memory routing: `onNavigate(path, how)` is told each
place the reader goes to (the path within the app — `/places/overview` for
the scene — and `"push"`, `"replace"` or `"pop"`), and `handle.setPath(path)`
sends the reader back to one when the host's own Back arrives: the
scene's path draws the scene, any other the page. `where().path` is the
place's path the same way.

## When the declaration changes

A chat that changes the app hands the host a new compiled app and a new
store. `handle.setApp(app, store)` swaps them under the reader (or
`setApp(app, remote)`, whose presence comes with it), and the reader stays
where they were:

```ts
remote.onDeclaration((next) => handle.setApp(latestApp, next));
```

The face, the place or record open on Pages, and the scene's stop and
focus are kept. What the change took away falls back to its nearest
parent: a removed record to its kind's list (or, in the scene, its kind's
group); a removed kind or place to the home; a lens gone from the scene to
its kind's group, or the home when the kind went too. Under address
routing the address stays the source of truth, and one that names
something gone is replaced, not pushed. The seat, the seats, the people,
the scheme, the brand and the notices stay; the faces are drawn again, so
an open menu, a scroll position and a half-typed field do not. `drawn()`
resolves once the new app is on the page.

A renamed app says its new name at once (FR-128). A `label` that was the
app's own name — as a host that mounts with `label: app.name` gives it —
follows the new app: the embed's accessible name and each landmark inside
say the new name, and the bar's name — its heading — is the new app's. A label the host chose ("Chapter 13") stays;
`setApp(app, store, { label })` gives another, and `handle.setLabel(label)`
renames the embed in place. `handle.setHostActions(actions)` changes the
host's own actions in the profile menu the same way.

A host that must remount reads the place first and hands it back:

```ts
const at = handle.where();           // { face, path, stop, kind? }
handle.unmount();
handle = mount(root, { app, store, at });
```

## What stands over what

Every popover, menu and list of suggestions the embed draws — the profile,
the problems, the districts a row could not hold, a card's acts at the
pointer — opens in the browser's top layer, hung from what opened it and
kept to the viewport, so nothing in the embed (the seat's rail, the
altitude control, the scene) and nothing on the host's page stands over it.
It is still inside the embed's element, so the scoped theme reaches it and
nothing of it lands on the host. Everything that stays on screen takes a
rung of one ladder, written once as custom properties on the embed's
element: the scene, then the altitude control, then the rails and floating
controls, then popovers, dialogs and notices, `--graview-layer-scene`
through `--graview-layer-toast`. A host that lays something of its own over
the embed reads the rung it means rather than guessing a number.

## The host's own actions

A host's links about the app and the person — "Change the app", "Your
apps", "Report this app" — go in the person's menu on the app bar, under who is
signed in, rather than in a menu of the host's own laid over the scene:

```ts
mount(root, {
  app,
  hostActions: [
    { label: "Change the app", href: `/apps/${id}/change` },
    { label: "Your apps", href: "/apps" },
    { label: "Report this app", href: `/report?app=${slug}`, target: "_blank" },
    { label: "Sign out", onSelect: () => signOut() },   // a press rather than a link
  ],
});
```

Each is a stop for the keyboard in the menu, in the order given, drawn in
the embed's own scheme; a press closes the menu. The whole-page Shell takes
the same host actions.

## The seat, put away

The seat's rail — the subject, its acts, its relations, the conversation —
stands as a column at the picture's left edge. A reader puts it away to a
slim tab from its header and opens it again from the tab, by the pointer
or the keyboard, and what they chose is remembered for the app (in
`memory`, or the page's storage, wherever the browser allows it). Put
away, the picture and its controls take the whole width but the tab, and
the city lays out into it. Narrower than a laptop, the open rail lies over
the picture instead of taking a column of it; on a phone it is a sheet
along the bottom. The host says where it starts:

```ts
mount(root, { app, companion: "collapsed" });   // "open" (the default), "collapsed" or "hidden"
```

The reader's own choice wins over `"open"` and `"collapsed"`; `"hidden"` is
the host's to make, and draws no rail and no tab at all.

## The host's notices

What the host has to say while the app is open — a newer version, the
connection gone, the app held while a repair is checked, a conflict to
settle, a refusal — it says in the app's own notices rather than in
elements of its own fixed over the app:

```ts
const offline = handle.notify({ kind: "banner", sentence: "Offline — changes will be sent when you reconnect.", tone: "warn" });
offline.update({ sentence: "Back online.", tone: "good" });
offline.dismiss();

handle.notify({ kind: "toast", sentence: `The app was changed — now version ${version}` });
handle.notify({
  kind: "toast",
  sentence: conflict.sentence,
  tone: "warn",
  actions: [{ label: "Keep theirs", onSelect: conflict.keepTheirs }, { label: "Use mine", onSelect: conflict.useMine }],
});
handle.notify({ id: "newer", kind: "banner", sentence: "A newer version is available.", action: { label: "Reload", onSelect: () => location.reload() } });
```

A toast goes by itself after six seconds (`timeout` says otherwise, `false`
keeps it), unless it carries an action, when it waits for one; a banner stays
until it is dismissed. A notice said again under the same `id` takes the
place of the one before. An action is a press (onSelect) or a link
(`href`), and either closes the notice; every notice also has a dismiss
control. Banners are drawn at the top of the picture and toasts at its
foot, in the framework's floating panel and the embed's scheme, in the
top layer and kept over any popover that opens after them; each is said
aloud as it arrives, and one whose tone is bad is said as an alert.
`@graview/embed/pages` has the same `notify`; a React host drawing
`<Embed>` makes a board with `createNoticeBoard()`, passes it as
`notices`, and says things on it.

## What went wrong, and how long it took

```ts
mount(root, {
  app,
  onError: ({ name }, { module, face }) => beacon("embed-error", { name, module, face }),
  onReady: ({ ms, face }) => beacon("embed-ready", { ms, face }),
});
```

A view, a page, the bar or the studio that throws is contained where it
threw: it says it could not draw and offers to try again, and the rest of
the embed keeps working. The host is told the error's class (a TypeError,
a `GraphError`) and the framework module that caught it, never the message,
which may quote a record. The ready callback is told once, when the first face is drawn,
how many milliseconds it took.

## What the host can keep

The Studio is in the person's menu on the scene for the seat that keeps the app, and writes
through a dev server's door or hands over files. A host whose readers
cannot save a declaration leaves it off, or keeps what it applies:

```ts
mount(root, { app, studio: false });                      // no Studio place at all
mount(root, { app, studio: { onApply: ({ app, migration, files }) => propose(app) } });
```

Handed an onApply, the studio asks after no door and writes nothing; what the
checker passed is the host's. A host that could not keep it answers ok: false
with a sentence, which the studio says as its heading, and findings, which
may be empty; an Apply with nothing changed is said by the studio and never
reaches the host.

`@graview/embed/pages` is the routed face alone, with the same options less
the face, the stop, the heading and the studio, and the same handle less the
faces. It takes `views`, and its pages draw the same cards, rows and record
pages the whole embed's would. A page that only ever shows the pages imports
that and does not bundle the scene, the Graview or the studio:

```ts
import { mount } from "@graview/embed/pages";
```

Bundled for the browser without React, the pages face alone is about 500 KB
minified (165 KB gzipped); the whole embed loads about 750 KB (190 KB) before a
face is fetched, and every face about 1.28 MB (370 KB);
`node scripts/inspect-pack.mjs` fails CI when one passes its budget
(`scripts/lib/bundle-budget.mjs`).

## In a chat's widget

An MCP Apps frame (a ChatGPT or Claude widget) may refuse storage, is sized
from its content, and is told its theme by the chat. The embed holds there:

```ts
const remote = await openRemote({ app, url, principal });   // @graview/ship
const handle = mount(root, {
  app,
  remote,                       // the store, and who is here, from the server
  principal,                    // who signed in: the only seat a hosted reader has
  people,                       // [{ id, name, kind? }]: names for the rail, offering nobody a seat
  height: "auto",               // the pages face as tall as its page
  pagesBelow: 560,              // narrower than this, the scene gives way to the pages
  hostContext: { theme },       // the chat's theme, over the page's own
  memory,                       // where the reader's settings are kept, if not the page's storage
  onIntrinsicHeight: (height) => notify("ui/notifications/size-changed", { height }),
});
handle.setHostContext({ theme: "dark" });   // the chat changed theme
handle.setPeople(next);                     // an agent who first acted after the page opened
```

Nothing touches `localStorage` or `sessionStorage` without a fallback, so a
frame that throws on either still mounts. `scheme: "auto"` (the default)
follows the host context, then the page's `data-theme` stamp, then the
system's preference, each as it changes. Presence a channel reports is
dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or
not the channel says the person left. A host that builds presence itself
keys each participant with `participantKey({ kind, id, session })` from
`@graview/core`, the op log's own `kind:id:session`.
