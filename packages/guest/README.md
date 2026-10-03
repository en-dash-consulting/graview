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
