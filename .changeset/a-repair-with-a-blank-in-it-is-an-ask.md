---
"@graview/pages": patch
"@graview/core": patch
---

A repair with a blank in it is an ask. The problems page and the record page rendered every repair a rule named as a bare button applying the violation's own arguments, so a repair declaring `missing: ["owner"]` threw "expected string, received undefined" into the console and told the person nothing. Both surfaces — and the scaffolder's record-page template — now use one exported `Repairs` component: one press when the repair needs nothing, the derived form when it still has something to choose, and a refusal said where the press happened.
