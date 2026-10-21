# @graview/embed

`@graview/embed` is one of the 14 npm packages of Graview, a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration. Mount a declared Graview app into any element — the scene, the Graview, or the routed pages — without the Shell, sized and themed within the element.

```sh
pnpm add @graview/embed
```

Entry points: `@graview/embed`, `@graview/embed/pages`, `@graview/embed/form`, `@graview/embed/first-draw`

## What it is

Mount a declared Graview app into any element — a paragraph of a docs page, a card on a dashboard, a preview in a builder — without the Shell, sized to the element, themed within it, under one app bar.

```ts
import { mount } from "@graview/embed";

const handle = mount(document.querySelector("#garden")!, {
  app,                        // defineApp(...)
  seed,                       // the graph to open with, or nothing
  face: "graview",            // "scene" | "graview" | "pages" | "picture" — one named lens, no chrome: stop "#view=<place>"; leave it out and the app opens on its home view, else the scene
  stop: "#focus=plot-1",      // the scene's view state, as its URL fragment; none, and the scene opens on the overview
  path: "/plots",             // the routed face's page; on the scene, nothing or "/places/overview" — the whole thing from above
  principal: { kind: "human", id: "june", roles: ["coordinator"] },
  bar: true,                  // the app bar over every face (the default); { faces: false, name: false } under a host's own bar
  switch: "words",            // the bar's Scene/Pages switch: its words where they fit (the default), or "icons" for its marks alone
});

handle.setPath("/plots");     // a place: the plots' list, at the element's width
handle.setPath("/places/overview"); // the scene, at its own address
handle.setStop("#overview=1&expand=kind:plot");
handle.unmount();
```

A scene with nowhere to be — no `stop`, no `path` but the overview's, no first place in the declaration — opens on the overview, the whole thing from above, as `graview preview` at `/places/overview` does: `mount(stage, { face: "scene" })` under either routing, and `routing: "address"` at a bare base. A `stop` set then or later goes down to it.

`<Embed {...options} />` is the same thing as a React component.

### The app bar

One bar stands over every face (FR-131). At the left, the app: its mark — the brand's logo, when the document has one — and its name, said once, as the page's heading (`heading`: `1` when the host's page is the app, `2`, the default, inside an article, `false` when the host's own heading says it), and the way home. Right after it, the switch between the app's two faces (FR-137): "Scene" and "Pages", an icon and a word each, two buttons whose `aria-pressed` says which is drawn. The words are drawn where they fit and the icons alone where they do not — on a phone, or in a narrow box beside a long place name — and always their accessible names and their titles; `switch: "icons"` asks for the icons alone at every width, for a host whose box is small or whose own page already says what the two faces are (`[data-testid="app-faces"]` says what was asked in `data-switch` and what is drawn in `data-switch-drawn`). Scene draws the scene under the bar; Pages goes back to the page the reader was on. A declaration may call them something else (`pages: { scene: "The farm", pages: "Lists" }`); the scene's address is `/places/overview` whatever it is called. Then, on Pages, the place you are on as one control — its name and a chevron — that opens every place the app has (FR-138): the home first, then the Lists (one per kind) and the Pictures (each named lens, and how the kinds connect), each with its mark, a long name wrapped. Every place is two presses away, Escape gives the keyboard back to the control, and the bar is one row of 48 px however many places there are; on a phone the place control is the page's first line, under the bar. On the scene the same control names what the scene shows — "The whole thing", or the picture in view — and lists its pictures (FR-144): choosing one moves the scene's `in.view`, and its address under `routing: "address"`, as any other way to a picture does. Where the bar has room after the name, the switch and the tools, the places themselves stand on the row as words in their order, the one you are on underlined and always among them, and the rest fold into "More" (FR-145); measured from the bar's own width, so a narrow box keeps the one control. A harness reaches any place the same way at every width: `[data-testid="app-place-<key>"]` (with its `data-place-path`) is one element in the embed — press it if it is visible, else press `app-places-open` ("More", or the one control) and then press it in `app-places`; `app-place-current` says where the reader is. At the right, three tools of one size: Find (a small box that says "Find…" and its shortcut, ⌘K on a Mac and Ctrl K elsewhere, and is drawn wide while it is used; a magnifier that opens the box over the row on a phone), the standing (a dot in the tone of the rules, a number only when one is broken, opening what is broken; its name says "Everything is in order" otherwise), and the person (an avatar whose menu holds who is signed in, the seats, the host's own actions and, for whoever keeps the app, the installation and the studio). `bar: false` draws none of it, for a host whose own page already says all of that.

UNDER A HOST'S OWN BAR. A product with its own shell that mounts the scene in it says what the bar leaves out (`EmbedBar`): `faces: false` draws no switch — its Pages side is Graview's derived pages, not the product's own — and `name: false` no app mark and name, which the product's bar already says. The scene's places, Find, the standing (Activity beside it once anything has happened) and the person stay. Pass `heading: false` too, so nothing in the embed says the app's name as a heading.

```ts
mount(stage, { app, store, face: "graview", bar: { faces: false, name: false }, heading: false });
```

`@graview/embed/pages` takes `bar: { name: false }` the same way (it has no switch to leave out).

THE BAR FITS ITS BOX. Every rule the bar is drawn by reads the bar's own width, never the screen's: an embed in a 650 px box on a 1440 desk is a narrow bar, not a desk's bar squeezed, and below 640 px of its own it is a phone's bar (the place on the first line under it, Find a magnifier, Find's list a sheet the bar's width under it). When the row is short, Find gives first, down to a box that still says "Find…"; then the place, down to 9em of its name (whole in its title); then the app's name, which wraps between its words onto a second line and never inside one, its whole name the way home's title. The bar stays one row of 48 px in any box from 480 px up.

A HOME VIEW IS THE FRONT PAGE (FR-136). An app with a home view — the declaration's `views.home`, or a worker view attached to `"home"` — opens on Pages at its home, full width under the bar, on a desk as on a phone, when the host names no face; under address routing it does so at the bare address whatever face the host names. Nothing floats over the scene. A declaration that names another first place (`pages.first`) opens there.

A VIEW OF ONE RECORD SITS ABOVE ITS FIELDS (FR-149). A worker view registered through `views` with `cardinality: "one"` is drawn above the record's own fields, which stay editable: on the scene the record drawn at full is the view and then its fields, on Pages the record's page is its heading, the view, then its facts and what can be done. Its manifest's `replaces: "page"` draws it alone instead. A view may ask the host to fill a field from the record it draws (`data-prefill`, FR-150): see `@graview/guest`.

### What a page loads first

The frame — the element's region, its theme, the app bar, the provider — is on the page when `mount` returns. Each face is a chunk of its own, fetched the first time it is drawn: a page that opens on the pages never loads the scene, one that opens on the scene never loads the router, and the framework's own cards, rows and record pages come with whichever face draws them first. Until a face's chunk arrives its box stands empty (`aria-busy`), and `handle.drawn()` resolves once the face asked for is on the page — after `mount`, and after every change of face.

A face on the page is not yet a place a person can read: its parts, the fonts, a worker view's drawing and its pictures may still be on their way. Once the place the reader is on has drawn and settled — every part drawn on it arrived, the fonts and images loaded, each worker view drawn (or stopped, what stands in its place drawn), each frame guest drawn (or silent past its `limits.readyMs`, eight seconds by default) and nothing moving for 200 ms — the embed's root wears `data-graview-drawn`, its value the place's path, and `onDrawn(place)` is told where it is as `where()` says it. A move to another place takes the attribute off in the same commit, and the next place puts it back as it settles. A place that never stops moving is said drawn after ten seconds all the same. A host picturing a place headless waits for the attribute rather than a timer:

```ts
await page.waitForSelector("[data-graview-drawn]");
```

A frame guest (`guestView({ url })`) has drawn once it has said it is ready, been handed what it shows and asked for its height — or stayed quiet for a moment after, if it never asks — and its frame says `data-guest-view-drawn`; one that never says it is ready says `data-guest-view-failed="silent"`. Until one or the other, the frame is `aria-busy`, and so is its holder until the frame's host has drawn the frame in it.

A host that knows its face before it mounts starts that chunk at once, beside its own requests, and an embed mounted once it is here draws it in the first commit:

```ts
import { mount, preload } from "@graview/embed";

const face = innerWidth < 768 ? "pages" : "graview";
const faceReady = preload(face);            // with no face named, every face
const app = await fetchAndCompile();        // the host's own round trips, meanwhile
await faceReady;
const handle = mount(root, { app, face });  // drawn in this commit
```

A face opens doors of its own as it first draws — on the pages the home's lenses, a list's arranging, the bar's Activity and a form's date box; on the scene the relations' ribbons, the city's ground, the districts' states and the way back after an act — each a chunk asked for only once the face has run, a round trip after the face's own on a phone (FR-194). They stay doors, so a page that never draws a lens never runs one, and `@graview/embed/first-draw` names them for a host's build: `firstDrawChunks(metafile, face)` reads esbuild's metafile and returns the chunks a face's first draw asks for — each door's chunk and every chunk it imports outright — to name in the page's head beside the face's own; `FIRST_DRAW_DOORS` is the list it reads, each door by its package and module. It is a build script's, never the page's: importing it costs a page nothing.

```ts
import { firstDrawChunks } from "@graview/embed/first-draw";

const built = await esbuild.build({ ...shell, splitting: true, metafile: true });
const doors = firstDrawChunks(built.metafile, "pages").map((chunk) => `/${chunk.split("/").pop()}`);
// Less what the head already names for the face itself.
```

Ask for them once the face's own chunks have arrived, not beside them: on a phone's network a door named beside the face takes its bandwidth, and the face draws later. `graview preview`'s page writes them from a script in its head that waits for each `modulepreload` link's `load`; so asked, the face drew when it did and the place settled about half a second sooner on a slow 4G (`pnpm verify first-load`).

What is fetched before it is wanted — the acts' pane when the page is idle, a date's editor, the other face at a desk — waits until the place has first drawn and settled (`data-graview-drawn`), so on a phone the network is the first draw's until then.

What this asks of the framework, and what it adds: the theme scopes to the element (`themeBaseCss(scheme, brand, { scope })`, and the blocks a view is drawn with, `viewsCss`, and the scene's own rules, `sceneCss`, drawn by the face that needs them beside it) rather than the document, every rule of it held inside that element, so nothing of the host's is restyled; the panes size against the picture's own box (`cqh`) rather than the viewport; the routed face runs on a memory router, so the host page's address is never touched (unless the host's page is the app: see below); the brand's fonts are fetched by the embed rather than assumed. The page's icon is the host's: only a host whose page is the app passes `favicon: true` to wear the brand's (FR-124), and an app that prefers dark is drawn dark until the host stamps a scheme of its own. The store is in memory and starts from the seed on every mount, unless the host hands it one.

### When the page is the app: the address bar

A host whose whole page is the app — Graview Cloud's hosted app is one — hands the routed face the address bar, so a place, a record and the home can be linked, reloaded and shared:

```ts
const handle = mount(root, {
  app, store,
  face: innerWidth < 768 ? "pages" : "graview",  // where a bare address opens
  routing: "address",                            // the default is "memory"
  basePath: "/apps/a1/",                          // where the app is served; "/" by default
});
```

The host answers every address under the base with the same page. The address then says which face is drawn and where on it, as the whole-page Shell spells it:

| Address | Drawn |
| --- | --- |
| `/apps/a1/places/the-board`, `/apps/a1/tasks/t1` | the routed face, at that page |
| `/apps/a1/places/overview#focus=t1`, `/apps/a1/places/overview#overview=1` | the scene, at that stop (the Graview at altitude) |
| `/apps/a1#focus=t1` | the scene too — a link written before the scene had an address — tidied on arrival to the scene's address |
| `/apps/a1` | the routed face's home; on arrival, the home when the app has a home view, else the host's `face` (the Graview or the scene land on the scene's address) |

Each page the routed face opens is pushed, and Back returns. The scene keeps its stop in the fragment the way the Shell does: a step is pushed, moving the furniture replaces. The switch and the place list push the address of where they go, the scene's included, so Back undoes it. A reload stays where it was. `faceAtAddress(options)` is the face an address opens on, for a host that renders `<Embed>` itself. `placesOf(app)` from `@graview/core/seat` gives each place's `address` within the app, and `addressOf(place, { basePath })` from `@graview/core` gives it under the base, spelled as the face's own links are (`pathWithin` reads one back).

`routing: "memory"`, the default, is for somebody else's page: it never writes `history` and leaves `location` as it was. A host that keeps its own history stays on memory routing: `onNavigate(path, how)` is told each place the reader goes to (the path within the app — `/places/overview` for the scene — and `"push"`, `"replace"` or `"pop"`), and `handle.setPath(path)` sends the reader back to one when the host's own Back arrives: the scene's path draws the scene, any other the page. `where().path` is the place's path the same way.

### When the declaration changes

A chat that changes the app hands the host a new compiled app and a new store. `handle.setApp(app, store)` swaps them under the reader (or `setApp(app, remote)`, whose presence comes with it), and the reader stays where they were:

```ts
remote.onDeclaration((next) => handle.setApp(latestApp, next));
```

The face, the place or record open on Pages, and the scene's stop and focus are kept. What the change took away falls back to its nearest parent: a removed record to its kind's list (or, in the scene, its kind's group); a removed kind or place to the home; a lens gone from the scene to its kind's group, or the home when the kind went too. Under address routing the address stays the source of truth, and one that names something gone is replaced, not pushed. The seat, the seats, the people, the scheme, the brand and the notices stay; the faces are drawn again, so an open menu, a scroll position and a half-typed field do not. `drawn()` resolves once the new app is on the page.

A renamed app says its new name at once (FR-128). A `label` that was the app's own name — as a host that mounts with `label: app.name` gives it — follows the new app: the embed's accessible name and each landmark inside say the new name, and the bar's name — its heading — is the new app's. A label the host chose ("Chapter 13") stays; `setApp(app, store, { label })` gives another, and `handle.setLabel(label)` renames the embed in place. `handle.setHostActions(actions)` changes the host's own actions in the profile menu the same way.

A host that must remount reads the place first and hands it back:

```ts
const at = handle.where();           // { face, path, stop, kind? }
handle.unmount();
handle = mount(root, { app, store, at });
```

### A view proposed and not kept

A chat that proposes a worker view can try it headless and be told what it drew in words; to see it at a phone's width in dark it had to keep it first. `draftView` draws one for the seat at the keyboard without keeping it: its manifest and its `source` (or `worker`, and anything else a `WorkerViewDefinition` takes but `draft`):

```ts
mount(root, { app, remote, routing: "address", draftView: { manifest, source, author: "Proposed by Claude" } });
```

It is drawn where its manifest attaches — the home, a kind's list at the place its title names (`/places/<title>`), each record's page — under one line, "Draft — <title> · Not kept", in a group named "Draft: <title>" (`[data-graview-draft-view="<name>"]`), as the seat's drawn panel is marked on `/~draft`. A kept view of the same name is the one it stands in for: the host's `views` may register it as ever, and it is drawn nowhere beside the draft. A draft that is stopped says why in its place rather than standing the kind's own face there. Nothing of it is kept: it is registered under no name, so the place menu offers no Hide or Delete and `keptViews` is asked nothing; the store is not written; the next page, handed no draft, has none. The worker's host is fetched before the embed draws, and only when a draft is handed. With `data-graview-drawn`, a host pictures the proposal once it has drawn. `graview preview` and `graview shots` take one as `--view <view.js> --manifest <manifest.json>`.

A host picturing several proposals in turn swaps them in place rather than mounting again: `handle.setDraftView(draft)` draws another, and `handle.setDraftView(null)` the app's own views again. The store, the place and the seat stay; `data-graview-drawn` comes off in the call and comes back, with `onDrawn` told again, once the new draft has drawn and settled:

```ts
for (const proposal of proposals) {
  handle.setDraftView(proposal);
  await page.waitForSelector("[data-graview-drawn]");
  // picture it
}
```

Under a base path — the page the app, served at `/a/<app>` — a draft of a kind's view is drawn at `/a/<app>/places/<title>`, and the attribute's value is the place's path within the app (`/places/<title>`).

### What stands over what

Every popover, menu and list of suggestions the embed draws — the profile, the problems, the districts a row could not hold, a card's acts at the pointer — opens in the browser's top layer, hung from what opened it and kept to the viewport, so nothing in the embed (the quick ask's card, the altitude control, the scene) and nothing on the host's page stands over it. It is still inside the embed's element, so the scoped theme reaches it and nothing of it lands on the host. Everything that stays on screen takes a rung of one ladder, written once as custom properties on the embed's element: the scene, then the altitude control, then the rails and floating controls, then popovers, dialogs and notices, `--graview-layer-scene` through `--graview-layer-toast`. A host that lays something of its own over the embed reads the rung it means rather than guessing a number.

### The host's own actions

A host's links about the app and the person — "Change the app", "Your apps", "Report this app" — go in the person's menu on the app bar, under who is signed in, rather than in a menu of the host's own laid over the scene:

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

Each is a stop for the keyboard in the menu, in the order given, drawn in the embed's own scheme; a press closes the menu. The whole-page Shell takes the same host actions.

### The quick ask

Where the host gives a model, ⌘K (Ctrl+K) opens a command bar beside what the reader is on — the selected card on the scene, the record or list on a page — that completes the acts on it, "Show …" for a panel the app can draw of it, its places and its records. Words that complete nothing are asked, and the answer is a card beside the record or the list: a few sentences, what acts on it (a place, a record, a panel), and the changes it proposes waiting as a ghost to be accepted, in part or whole, as one batch with one undo. A follow-up is asked on the card and replaces its answer; it is not a thread. The context menu's "Ask about this…" and Find's last row, "Ask: ‘…’", open the same card. Escape closes it and puts the keyboard back. The host can leave it out:

```ts
mount(root, { app, quickAsk: false });
handle.setQuickAsk(true);                    // on whichever face is open, without mounting again
mount(root, { app, quickAsk: quickAskOf(stored) }); // a 0.1.30 setting kept as "field" or "hidden"
```

What answers it is the host's to decide, once — a reader is never asked:

```ts
mount(root, {
  app,
  ai: {
    thinking: { model: "house-model", think: ({ system, prompt }) => myModel(system, prompt) },
    fast: jevFast({ apiKey }),               // typed picks among what the app offers, if you have one
    // answer: { model, answer: ({ said, targetLabel, state, catalog, follows }) => ({ text, pick }) },
    // off: true,                            // AI off: no quick ask, no inline AI, nothing of either drawn
  },
});
```

`answer` is the quick ask's own slot: handed the words, what they are about, the state the reader may see, the catalog of what the app offers there and the one ask before it, it answers text and, optionally, ids from the catalog; any other id is dropped. Unsaid, the Thinking slot answers, else the Fast slot picks among the candidates. With no model, or `off`, there is no quick ask at all.

### The host's notices

What the host has to say while the app is open — a newer version, the connection gone, the app held while a repair is checked, a conflict to settle, a refusal — it says in the app's own notices rather than in elements of its own fixed over the app:

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

A toast goes by itself after six seconds (`timeout` says otherwise, `false` keeps it), unless it carries an action, when it waits for one; a banner stays until it is dismissed. A notice said again under the same `id` takes the place of the one before. An action is a press (onSelect) or a link (`href`), and either closes the notice; every notice also has a dismiss control. Banners are drawn at the top of the picture and toasts at its foot, in the framework's floating panel and the embed's scheme, in the top layer and kept over any popover that opens after them; each is said aloud as it arrives, and one whose tone is bad is said as an alert. `@graview/embed/pages` has the same `notify`; a React host drawing `<Embed>` makes a board with `createNoticeBoard()`, passes it as `notices`, and says things on it.

### What went wrong, and how long it took

```ts
mount(root, {
  app,
  onError: ({ name }, { module, face }) => beacon("embed-error", { name, module, face }),
  onReady: ({ ms, face }) => beacon("embed-ready", { ms, face }),
});
```

A view, a page, the bar or the studio that throws is contained where it threw: it says it could not draw and offers to try again, and the rest of the embed keeps working. The host is told the error's class (a TypeError, a `GraphError`) and the framework module that caught it, never the message, which may quote a record. The ready callback is told once, when the first face is drawn, how many milliseconds it took.

### What the host can keep

The Studio is in the person's menu on the scene for the seat that keeps the app, and writes through a dev server's door or hands over files. A host whose readers cannot save a declaration leaves it off, or keeps what it applies:

```ts
mount(root, { app, studio: false });                      // no Studio place at all
mount(root, { app, studio: { onApply: ({ app, migration, files }) => propose(app) } });
```

Handed an onApply, the studio asks after no door and writes nothing; what the checker passed is the host's. A host that could not keep it answers ok: false with a sentence, which the studio says as its heading, and findings, which may be empty; an Apply with nothing changed is said by the studio and never reaches the host.

`@graview/embed/pages` is the routed face alone, with the same options less the face, the stop, the heading and the studio, and the same handle less the faces. It takes `views`, and its pages draw the same cards, rows and record pages the whole embed's would. A page that only ever shows the pages imports that and does not bundle the scene, the Graview or the studio:

```ts
import { mount } from "@graview/embed/pages";
```

It says when a page has drawn as the whole embed does — `onDrawn(place)`, and `data-graview-drawn` (`DRAWN_ATTRIBUTE`) on its root — and takes a `draftView`, swapped in place with `handle.setDraftView`, drawn and marked as the whole embed draws one, the worker's host fetched only when a draft is handed.

### A form for a visitor

`@graview/embed/form` draws one act's form alone — the declaration's `forms.<name>` — for somebody who never joins the workspace: an RSVP, a sign-up. No bar, no lists, no record, no seat. The host mints a visitor per answer and hands its id; the form runs as that visitor (`formVisitor` from `@graview/core/forms`: the form's role, named "a visitor via the RSVP form") over the store as they are served it, and says the answer was received in the declaration's words:

```ts
import { mount } from "@graview/embed/form";
const remote = await openRemote({ app, url, principal: formVisitor(app, "rsvp", token) });
mount(el, { app, form: "rsvp", principal: token, remote, height: "100dvh", onSubmitted });
```

`principal` is the minted id (`"form:<token>"`) or the visitor whole. A form the declaration has not got is refused by its name. `graview preview` serves each form at `/forms/<name>`. The `graview-visitor-forms` skill says the declaration and its grant.

Bundled for the browser without React, the pages face alone is about 500 KB minified (165 KB gzipped); the whole embed loads about 750 KB (190 KB) before a face is fetched, and every face about 1.28 MB (370 KB); `node scripts/inspect-pack.mjs` fails CI when one passes its budget (`scripts/lib/bundle-budget.mjs`).

### In a chat's widget

An MCP Apps frame (a ChatGPT or Claude widget) may refuse storage, is sized from its content, and is told its theme by the chat. The embed holds there:

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
  subscriptions,                // where Notify me is kept, if not the page's memory
  signIn,                       // while nobody is signed in: { label, run, roles? }, the way in
  onIntrinsicHeight: (height) => notify("ui/notifications/size-changed", { height }),
});
handle.setHostContext({ theme: "dark" });   // the chat changed theme
handle.setPeople(next);                     // an agent who first acted after the page opened
```

`subscriptions` is the store the sheet "Notify me…" adds to and Activity's list of what the reader is told of reads, on either face. A served store's is `remoteSubscriptions({ url, principal })` from `@graview/ship/browser`, a module of its own: asking the route brings none of the rule language its server judges a subscription with into the page's first chunk. Unsaid, a reader's subscriptions live in the page's memory and go when it closes.

`signIn` is handed only while the reader is a visitor: `{ label: "Sign in to make changes", run }`, with `roles`, the roles signing in gives, when the host knows them. Where every act withheld from the reader is one a member could take, the context menu, the Inspector and the pages' acts say `label` as one press that calls `run`, in place of each act struck through with the policy's sentence; the face's own rows (Open, Show in the scene) stay, and "Notify me" is not offered, there being nobody to tell. A member lacking one role is still told each act they may not take and who could. `signInInstead(withheld, signIn)` from `@graview/core` is the same judgment, for a page of your own.

Nothing touches `localStorage` or `sessionStorage` without a fallback, so a frame that throws on either still mounts. `scheme: "auto"` (the default) follows the host context, then the page's `data-theme` stamp, then the system's preference, each as it changes. Presence a channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A host that builds presence itself keys each participant with `participantKey({ kind, id, session })` from `@graview/core`, the op log's own `kind:id:session`.

## What it exports (14)

Read off the package's own barrel, so this is what is there today.

`AUTO_SCENE_HEIGHT`, `createNoticeBoard`, `DRAWN_ATTRIBUTE`, `Embed`, `faceAtAddress`, `faceOf`, `familiesOf`, `FIRST_LOOK_ANCHORS`, `fontsLink`, `hostScheme`, `mount`, `mountWhenNear`, `preload`, `quickAskOf`

---

Mount a declared Graview app into any element — the scene, the Graview, or the routed pages — without the Shell, sized and themed within the element.

The page: https://graview.dev/docs/packages/embed.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
