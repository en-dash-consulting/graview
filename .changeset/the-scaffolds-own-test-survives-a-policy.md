---
"@graview/core": patch
---

The test `graview create` writes still holds once the app says who may do what (the eleventh walk). The shelter followed graview-permissions and its `pnpm verify` went red on the scaffold's own `tests/domain.test.ts`: "expected [] to include 'add-animal'" — the derivation was asked for nobody, and every act in it was applied with no author, so a store under a policy refused them all and nothing said why. The test now takes every act, and asks the derivation, as somebody holding every role the app declares (`app.policy?.roles`), and says so where a reader meets it; with no policy it reads as before.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; a project made before keeps its own test.
