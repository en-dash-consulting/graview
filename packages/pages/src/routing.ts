/*
 * THE ROUTER THE ROUTED FACE RUNS ON, AS A DESIGN REACHES IT.
 *
 * A product's design, page or test links, reads its address and moves
 * through these, imported from `@graview/pages` — never from the router
 * package itself. The face mounts the router (`PagesApp`), so a component
 * drawn under it must reach the same copy of it, and a product that
 * depended on the router on its own could hold a second copy, or a
 * different major, whose context the face never set.
 *
 * Which router answers is this package's business alone: React Router
 * today, and a change of engine is a change here, not in every product.
 */
export { Link, MemoryRouter, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
export type { LinkProps, NavLinkProps } from "react-router";
