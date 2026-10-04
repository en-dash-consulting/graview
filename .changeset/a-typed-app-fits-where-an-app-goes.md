---
"@graview/core": patch
"@graview/primitives": patch
"@graview/studio": patch
"@graview/ship": patch
"@graview/embed": patch
---

A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.

Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
