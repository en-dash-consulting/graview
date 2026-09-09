# @graview/embed

Mount a declared Graview app into any element — a paragraph of a docs page, a
card on a dashboard, a preview in a builder — without the Shell, sized to the
element, themed within it, and switchable between its faces.

```ts
import { mount } from "@graview/embed";

const handle = mount(document.querySelector("#garden")!, {
  app,                        // defineApp(...)
  seed,                       // the graph to open with, or nothing
  face: "graview",            // "scene" | "graview" | "pages"
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
store is in memory and starts from the seed on every mount.
