# @graview/layout

Where everything goes, as a pure function.

```ts
layout(graph, schema, view, options) -> Layout
```

Same graph and same view state in, identical positions out. That purity is
what pays for the animation: `interpolate(a, b, t)` tweens ANY two layouts, so
a kind of navigation nobody anticipated animates like the ones that were
designed, and no transition is written by hand.

Three planes — focus, relations, context — plus a fourth altitude above the
stack where the kinds sit on a ring and your own interface stays live, shrunk,
in the middle of it. A node may declare a `natural` size distinct from the size
it is drawn at, and the renderer scales between them.

View state is a URL. Every stop has an address, the back button works, and
`sameView` decides whether two addresses are the same place.
