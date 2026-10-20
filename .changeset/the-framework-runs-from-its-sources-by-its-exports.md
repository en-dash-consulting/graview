---
"@graview/ship": patch
---

An app that runs the framework from its sources in development reads its aliases from the packages' own `exports`: `sourceAliases(root?)` on `@graview/ship/dev`. The framework's own apps and every product linked to a checkout by path listed one Vite alias per entry point by hand, and each new subpath export broke every app that missed it: the bare name's alias swallowed the subpath, and on 0.1.40's sources every linked product answered 500 ("Failed to resolve import \"@graview/core/words\" from ../../graview/packages/pages/src/facts.ts"). Now each export of `./dist/<path>.js` is aliased to its `src/<path>.ts` or `.tsx`, each alias matches its specifier exactly so no bare name swallows a subpath, and a test holds every export of every package a product depends on to a source file that exists. The framework's own apps use it; `sourceEntries(root?)` lists the same exports with the file each runs from. It throws for an installed package, which carries no `src`, rather than answering an empty list.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. Added: `sourceAliases`, `sourceEntries` and the `SourceAlias` and `SourceEntry` types on `@graview/ship/dev`. What Graview Cloud does: nothing.
