# @graview/embed

Mount a declared Graview app into any element — a paragraph of a docs page, a
card on a dashboard, a preview in a builder — without the Shell, sized to the
element, themed within it, and switchable between its faces.

```ts
import { mount } from "@graview/embed";

const handle = mount(document.querySelector("#garden")!, {
  app,                        // defineApp(...)
  seed,                       // the graph to open with, or nothing
  face: "graview",            // "scene" | "graview" | "pages" | "picture" — one named lens, no chrome: stop "#view=<place>"
  stop: "#focus=plot-1",      // the scene's view state, as its URL fragment
  principal: { kind: "human", id: "june", roles: ["coordinator"] },
  toggle: true,               // the face switcher and Standing, above the picture
});

handle.setFace("pages");      // the routed face, at the element's width
handle.setStop("#overview=1&expand=kind:plot");
handle.unmount();
```

`<Embed {...options} />` is the same thing as a React component.

What this asks of the framework, and what it adds: the theme scopes to the
element (`themeCss(scheme, brand, { scope })`) rather than the document; the
panes size against the picture's own box (`cqh`) rather than the viewport;
the routed face runs on a memory router, so the host page's address is never
touched; the brand's fonts are fetched by the embed rather than assumed. The
store is in memory and starts from the seed on every mount, unless the host
hands it one.

## What went wrong, and how long it took

```ts
mount(root, {
  app,
  onError: ({ name }, { module, face }) => beacon("embed-error", { name, module, face }),
  onReady: ({ ms, face }) => beacon("embed-ready", { ms, face }),
});
```

A view, a page, the strip or the studio that throws is contained where it
threw: it says it could not draw and offers to try again, and the rest of
the embed keeps working. The host is told the error's class (a TypeError,
a `GraphError`) and the framework module that caught it, never the message,
which may quote a record. The ready callback is told once, after the first render,
how many milliseconds it took.

## What the host can keep

The Studio is on the strip for the seat that keeps the app, and writes
through a dev server's door or hands over files. A host whose readers
cannot save a declaration leaves it off, or keeps what it applies:

```ts
mount(root, { app, studio: false });                      // no Studio place at all
mount(root, { app, studio: { onApply: ({ app, migration, files }) => propose(app) } });
```

Handed an onApply, the studio asks after no door and writes nothing; what the
checker passed is the host's.

`@graview/embed/pages` is the routed face alone, with the same options less
the face, the stop, the views and the studio, and the same handle less the
faces. A page that only ever shows the pages imports that and does not
bundle the scene, the lenses or the studio:

```ts
import { mount } from "@graview/embed/pages";
```

Bundled for the browser without React, the pages face alone is about 730 KB
minified (195 KB gzipped) and every face about 1.05 MB (300 KB);
`node scripts/inspect-pack.mjs` fails CI when either passes its budget
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
