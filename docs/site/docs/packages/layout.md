# @graview/layout

`@graview/layout` is one of the 14 npm packages of Graview, a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration. Where every node goes: three planes, one pure function of the graph and the view state.

```sh
pnpm add @graview/layout
```

Entry points: `@graview/layout`, `@graview/layout/view`, `@graview/layout/sizes`, `@graview/layout/view-moves`

## What it is

Where everything goes, as a pure function.

```ts
layout(graph, schema, view, options) -> Layout
```

Same graph and same view state in, identical positions out. That purity is what pays for the animation: `interpolate(a, b, t)` tweens ANY two layouts, so a kind of navigation nobody anticipated animates like the ones that were designed, and no transition is written by hand.

Three planes — focus, relations, context — plus a fourth altitude above the stack where the kinds sit on a ring and your own interface stays live, shrunk, in the middle of it. A node may declare a `natural` size distinct from the size it is drawn at, and the renderer scales between them.

View state is a URL. Every stop has an address, the back button works, and `sameView` decides whether two addresses are the same place.

## What it exports (66)

Read off the package's own barrel, so this is what is there today.

`AGGREGATE_PREFIX`, `aggregateId`, `areaOf`, `bandAggregateWords`, `bandCaps`, `bandCaptions`, `bandOf`, `boxOf`, `cameraLimit`, `CAPTION_HEIGHT`, `CAPTION_RISE`, `captionRuns`, `captionText`, `captionWidth`, `centroidOf`, `chooseGrouping`, `collides`, `DEFAULT_OPTIONS`, `districtsPastTheEdge`, `easeInOut`, `EDGE_SELECTION_PREFIX`, `edgeOfSelection`, `EMPTY_VIEW`, `estimateWidth`, `fitLabel`, `fromUrl`, `holdLayout`, `interpolate`, `isAggregateId`, `isBandAggregate`, `KIND_PREFIX`, `kindCardId`, `kindOfCard`, `kindsOf`, `kindsOfAggregate`, `layout`, `marqueeHeightFor`, `MIN_CAPTION`, `NameWidth`, `overlaps`, `packBand`, `packRuns`, `panForZoom`, `panLayout`, `placeCity`, `planeOf`, `rankKinds`, `ROSTER_MOST`, `ROSTER_ROW`, `rosterHeight`, `rosterRows`, `runOf`, `sameView`, `shares`, `spanAt`, `toggleExpanded`, `toUrl`, `withFocus`, `withJackIn`, `withoutMoves`, `withOverview`, `withPicture`, `withRelation`, `withSelection`, `withWithin`, `withZoom`

---

Where every node goes: three planes, one pure function of the graph and the view state.

The page: https://graview.dev/docs/packages/layout.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
