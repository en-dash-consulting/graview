# The packages

Graview, a TypeScript framework for agent-native apps built as isometric scenes, ships as 14 npm packages at one version. `graview` is the tool a person installs; `@graview/*` is the framework a product imports, each package depending only on the ones beneath it.

## All of them

- [@graview/core](https://graview.dev/docs/packages/core.html): The graph, the log, the schema and the checker. Everything a Graview app declares, and the CLI that verifies it.
- [create-graview](https://graview.dev/docs/packages/create-graview.html): Start a product on Graview: `npm create graview my-app`. The conventional door to `graview create`.
- [@graview/embed](https://graview.dev/docs/packages/embed.html): Mount a declared Graview app into any element — the scene, the Graview, or the routed pages — without the Shell, sized and themed within the element.
- [graview](https://graview.dev/docs/packages/graview.html): The Graview command line: start a product, check its declaration, write its agent docs, serve its store, host it for an agent over MCP, apply an act to it, sync its seed, install the authoring skills. The tool; @graview/* is the framework.
- [@graview/guest](https://graview.dev/docs/packages/guest.html): Guest views: somebody else's React or plain script in a sandboxed frame, or a hardened classic worker drawing a component kit, shown only what the viewer may see, able only to ask for acts the viewer's seat then applies.
- [@graview/layout](https://graview.dev/docs/packages/layout.html): Where every node goes: three planes, one pure function of the graph and the view state.
- [@graview/pages](https://graview.dev/docs/packages/pages.html): The traditional face: a routed webapp derived from the same declaration that drives the scene.
- [@graview/primitives](https://graview.dev/docs/packages/primitives.html): The primitive set, the lenses, the workbench and the visual system.
- [@graview/react](https://graview.dev/docs/packages/react.html): The React binding: a provider, a scene, and the hooks an app builds on.
- [@graview/render](https://graview.dev/docs/packages/render.html): The spatial renderer. The DOM path is what ships; the GPU capture path is EXPERIMENTAL — see README.
- [@graview/ship](https://graview.dev/docs/packages/ship.html): What every deployment needs, hosted or self-hosted: persistence wiring, op-log-native migrations, export, health.
- [@graview/skills](https://graview.dev/docs/packages/skills.html): Skills that teach an assistant the authoring moves, each ending in a real graview check verdict.
- [@graview/studio](https://graview.dev/docs/packages/studio.html): The declaration itself as a graph: kinds, fields, edges, acts, rules, roles and grants as nodes, edited with ordinary mutations in Graview's own interface, checked before they are applied, migrated, and written back as the files graview create writes.
- [@graview/tools](https://graview.dev/docs/packages/tools.html): Derived affordances and the agent tool surface, generated from the same declarations; graview mcp and graview apply host it against a real store.

---

The 14 packages Graview ships, what each is for, and what each exports.

The page: https://graview.dev/docs/packages.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
