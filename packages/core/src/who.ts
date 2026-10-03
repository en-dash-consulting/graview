import type { Author } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import { labelOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/**
 * AN AUTHOR BY NAME. A principal's id is its user node's id where the app
 * has an installation; where it has seats and no installation, the seat
 * carries the name the person was offered it under. The rail said
 * "user-lena Hometown (Again) no longer features Mara Vey" and the profile
 * "U user-june" — ids, in two places a person reads — while the seats had
 * been handed to the provider as "Lena, the label" and "June Arlo,
 * producer".
 */
export function nameOfAuthor(
  author: Pick<Author, "kind" | "id" | "name" | "onBehalfOf">,
  where: {
    readonly graph: { getNode(id: string): ({ id: string; kind: string } & Record<string, unknown>) | undefined };
    readonly schema: AnySchema;
    readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  },
): string {
  /*
   * FOR WHOM. An agent acting for a person is both of them — "Claude, for
   * Nick" — in the rail and in history alike (FR-06).
   */
  if (author.onBehalfOf) {
    const { onBehalfOf, ...itself } = author;
    return `${nameOfAuthor(itself, where)}, for ${nameOfAuthor(onBehalfOf, where)}`;
  }
  if (author.id === undefined) return author.name ?? (author.kind === "agent" ? "an agent" : author.kind);
  const node = where.graph.getNode(author.id);
  if (node) return labelOf(where.schema.tryDefinition(node.kind), node);
  const seat = where.seats?.find((one) => one.principal.id === author.id);
  if (seat) return seat.label;
  // The author's own name, where nothing here knows them: another person in a hosted app, an agent from a chat (FR-17).
  if (author.name) return author.name;
  /*
   * NEVER THE ID. An author nothing names — the store's own migration
   * ("ship:migration"), a seat the app did not list, a sync — is said by
   * what it is; its id is an identifier, and the activity rail printed
   * "ship:migration" above the upgrade it made (the seventh walk).
   */
  if (/(^|:)migration$/.test(author.id)) return "the upgrade";
  // A plain name ("kai") is how a host without seats names somebody; a namespaced id is not a name.
  if (/[:_/]/.test(author.id)) return { human: "somebody", agent: "an agent", rule: "a rule", system: "the system" }[author.kind];
  return author.id;
}

/**
 * THE CHANNEL, IN WORDS: "via Claude" for `mcp:Claude`, "via the API".
 * Nothing for `web` — a person at the interface is the ordinary case, and
 * saying so beside every line would be noise.
 */
export function viaSaid(via: string | undefined): string | undefined {
  if (via === undefined || via === "web") return undefined;
  if (via === "api") return "via the API";
  if (via === "cli") return "via the command line";
  const [channel, ...rest] = via.split(":");
  const name = rest.join(":");
  if ((channel === "mcp" || channel === "view") && name) return `via ${name}`;
  if (channel === "mcp") return "via an agent's tools";
  return `via ${via}`;
}
