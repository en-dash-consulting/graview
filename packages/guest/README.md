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
the viewer may not see is in none of them.

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
limits. A second ready from the same worker is dropped. What the guest draws
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
