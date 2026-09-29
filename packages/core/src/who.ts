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
  author: Pick<Author, "kind" | "id">,
  where: {
    readonly graph: { getNode(id: string): ({ id: string; kind: string } & Record<string, unknown>) | undefined };
    readonly schema: AnySchema;
    readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  },
): string {
  if (author.id === undefined) return author.kind === "agent" ? "an agent" : author.kind;
  const node = where.graph.getNode(author.id);
  if (node) return labelOf(where.schema.tryDefinition(node.kind), node);
  const seat = where.seats?.find((one) => one.principal.id === author.id);
  return seat?.label ?? author.id;
}
