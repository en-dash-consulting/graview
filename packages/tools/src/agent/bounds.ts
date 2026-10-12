/*
 * HOW MUCH ONE READ ANSWERS (FR-167). A seat's turn in an app of 30
 * components, 28 skills and 84 strengths read the whole graph in one
 * answer of about 28,000 tokens, and every step after it resent all of it:
 * seven steps, 91k tokens of input at the end, $0.60 for one question. A
 * read now answers a page, says how many more there are and how to ask for
 * them, and never more than `READ_CHARS` characters of JSON — for a seat's
 * turn and an MCP client alike, since both call the same runtime. The
 * reads themselves are `./reads.ts`, fetched with the first read.
 */

/** The most characters of JSON one read answers: about 2,000 tokens. */
export const READ_CHARS = 8_000;
/** The most records one page of `get_graph` lists, before `READ_CHARS` asks for fewer. */
export const READ_PAGE = 25;
/** The most links each way `get_node` names (id, kind and label), a page at a time. */
export const READ_LINKS = 20;
/** The most hits `search_graph` answers, whatever `limit` asked for. */
export const READ_HITS = 20;
/** The most problems one page of `get_violations` lists. */
export const READ_PROBLEMS = 20;
/** The most characters of one field's text a read carries; the rest is said as cut. */
export const READ_TEXT = 600;
