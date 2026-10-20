---
"@graview/ship": patch
"@graview/skills": patch
---

`graview sync-seed`'s dry run refuses what `--apply` would refuse, and names every record up front. A product's seed had one chapter at `step: 5` where the declaration says `step` is an integer of at most 4: the dry run printed 146 clean steps and exited 0, and `--apply` then refused all 180 with "… does not match what chapter declares / Step: Too big: expected number to be <=4", one record at a time. The steps' primitives are now applied to a copy of the live graph as the store applies them, and when the batch would fail each step is tried in turn, so the dry run lists every refusal at once — the step (`chapter c3 is put`, `c1 is patched: step`), the record by its label, the field and the declaration's words — says which steps fit, writes nothing and exits 1. `--apply` goes by the same judgment and refuses before it writes, so it refuses nothing the dry run passed. `--json` carries them as `refused: [{ step, record, fields, said }]`. A host reaches the same judgment as `seedRefusals(schema, steps, live)` and its sentences as `sayRefusals`, from the main and runtime entries. The `graview-ship` skill says the dry run refuses.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. `graview sync-seed` exits 1, not 0, on a seed the declaration refuses, dry run or not.
