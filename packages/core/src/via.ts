/**
 * THE CHANNEL, IN WORDS: "via Claude" for `mcp:Claude`, "via the API".
 * Nothing for `web` — a person at the interface is the ordinary case, and
 * saying so beside every line would be noise. Nothing for `ai:<name>`
 * either: which model the host's seat used to propose a change is kept in
 * the log for an audit, and a reader is never shown a provider's name —
 * the seat's own author already says the seat did it.
 *
 * A module of its own, apart from `nameOfAuthor`: a bundler places a whole
 * module in the chunk every reader of it shares, and only Activity — drawn
 * on the scene, fetched with it — says the channel, while a page names an
 * author up front.
 */
export function viaSaid(via: string | undefined): string | undefined {
  if (via === undefined || via === "web" || via.startsWith("ai:")) return undefined;
  if (via === "api") return "via the API";
  if (via === "cli") return "via the command line";
  const [channel, ...rest] = via.split(":");
  const name = rest.join(":");
  if ((channel === "mcp" || channel === "view") && name) return `via ${name}`;
  if (channel === "mcp") return "via an agent's tools";
  return `via ${via}`;
}
