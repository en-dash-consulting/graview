---
"@graview/tools": patch
---

The on-device model fetches WebLLM at one pinned version. A page whose host turned `onDevice` on imported `https://esm.run/@mlc-ai/web-llm` with no version, so it ran whatever the registry's latest was that day, with everything the page holds. Now it imports `@mlc-ai/web-llm@0.2.83` (`WEBLLM_URL`, exported from `@graview/tools`), and a host that serves its own copy names it — `onDevice: { webllm }`, or `localCompletion({ webllm })` — beside `load`, which still replaces the whole bring-up with a host's own engine. Moving the pin is a change of its own: whoever bumps it reads what that WebLLM release changed first. `local.test.ts` holds the pinned address and that a host's own copy is the one imported.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged.
