import type { AnyNodeDefinition } from "./types.js";

/*
 * THE KINDS A KIND IS DECLARED BESIDE: every definition, by the schema it was
 * last put in. A face reads one kind's record with that kind's definition
 * alone; what one of its computed fields works out can be a sum over
 * another kind's field (`sum(out('sessions'), length)`), so whether that is
 * a length of time is read from the kinds beside it (`field-words.ts`).
 */
export const FELLOWS = new WeakMap<object, readonly AnyNodeDefinition[]>();
