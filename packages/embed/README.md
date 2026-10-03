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
