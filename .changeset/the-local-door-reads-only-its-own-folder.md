---
"@graview/ship": patch
"@graview/skills": patch
---

The session the local door spawns reads only its own folder, takes its prompt as words, and is handed only the environment it needs. `localIntelligence` ran `claude -p <prompt> --tools Read --allowedTools Read` in a temporary folder with the dev server's whole environment but `CLAUDE*`: the working directory was the only bound on what Read could open, and the prompt — written from the graph, where other people's words are — could ask it to read `~/.ssh` or a checkout's `.env` and hand the contents back as a plan's arguments. Now Read is allowed only beneath the session's own folder (`--allowedTools "Read(./**)"`), the prompt comes last after `--` so words that begin with a dash are never a flag, and the environment is a list by name — `PATH`, `HOME`, the user, shell, locale and temporary folder, the proxies and certificates a network needs, and the CLI's own `ANTHROPIC_*` — so another service's key or a database's address the dev server holds never reaches a session a page's words steer. Ship's local-door test holds the argv, a prompt of flags kept after `--`, and an environment of dummy secrets reduced to what the CLI needs; no test runs the real CLI. The graview-desk skill says what the session is given.

Compatibility: ops and primitives, stored formats, the wire, the declaration and derived tool names and input schemas — unchanged. A host whose own `argv` builds on `argumentsFor` finds the prompt at the end now, after `--`.
