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
