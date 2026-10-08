# @graview/react

The binding. A provider, a scene, and the hooks an app builds on.

A view is an ORDINARY React component. No scene API, no base class — that is
the whole authoring surface, and it is the reason the capture approach earns
its cost. Every view must render correctly in both modes: captured into the
scene, and lifted out as a full page.

```tsx
<GraviewProvider store={store} views={views} brand={brand} principal={me}>
  <Scene />
  <JackedIn />
</GraviewProvider>
```

The provider holds the store, the view registry, the current view, the
selection, the activity and the principal — together, so the scene, the chrome
and an agent seat are looking at the same thing rather than at three copies of
it.

A part fetched only when it is first drawn is a `lazyModule` over
`retryingImport(() => import("./part.js"))` (from `@graview/core/retry`), drawn
with its `part(draw, { what })`. Until it arrives, its place says so in one
line with a "Try again" button (`lazy-part-missing`, `lazy-part-retry`)
rather than throwing; it is asked for again when the browser is back online,
when it is drawn again, on `prefetch()`, and when the button is pressed
(`retryLazyParts`). Every part the framework fetches as it is drawn — the
person's menu, the problems' rows, the faces, the views and lenses, the
studio, the assistant — is one.
