/*
 * `@graview/core/sync` — two-way sync on the op log: the engine, its
 * mappings, the conflict invariant, and the transports (Google Calendar, a
 * Notion database and a scripted one to test against, a
 * tool server over MCP).
 *
 * An entry of its own, not part of `@graview/core`: a hosted page imports the
 * main entry up front and draws without ever syncing, so the engine and its
 * transports are reached only by a host that runs one.
 */
export { CONNECTION_TAG, GOOGLE_COLORS, MADE_BY_GRAVIEW, connection, connectionMapping, creatingAct, inConnectionFilter, isDayField, notionConnectionMapping } from "./connection.js";
export type { Connection, ConnectionDeclaration, ConnectionRun, NotionSourceMapping } from "./connection.js";
export { connectionKinds, notionSourcesOf } from "../document/connection-spec.js";
export type { GoogleCalendarConnectionSpec, NotionConnectionSpec, NotionSourceSpec } from "../document/connection-spec.js";
export { googleCalendar, googleCalendarMapping } from "./google-calendar.js";
export type { Fetcher, GoogleCalendarOptions, GoogleTokenRequest } from "./google-calendar.js";
export { NOTION_API, NOTION_VERSION, NotionError, notion, notionKey, notionProperty, notionText, notionValue, notionVersion } from "./notion.js";
export type { NotionMade, NotionOptions, NotionSourceOptions } from "./notion.js";
export { NOTION_AUTH_ENV, NOTION_EDGE, NOTION_FITS, NOTION_READ_ONLY, notionFits } from "./notion-types.js";
export { scriptedNotion } from "./notion-stub.js";
export type { ScriptedNotion, ScriptedNotionOptions, ScriptedRequest } from "./notion-stub.js";
export { syncConflictInvariant, SYNC_CONFLICTS } from "./conflict.js";
export type { SyncConflictOptions } from "./conflict.js";
export { SyncEngine, edgeValue, sharedLinks } from "./engine.js";
export type { GuestChange, GuestLeftOut, SettledConflict, SharedLinks, SyncGuests, SyncOptions, SyncRefusal, SyncReport } from "./engine.js";
export { connectionStatus, guestsOf } from "./status.js";
export type { ConnectionStatus, RecordGuests } from "./status.js";
export { allowTools, doorClient, mcpClient, mcpDoor, mcpRemote, ownHost, sameOrigin } from "./mcp.js";
export type { DoorHeaders, DoorRequest, DoorResponse, McpClientOptions, McpDoorOptions, McpRemoteOptions, ToolCall } from "./mcp.js";
export { EMPTY_SYNC_STATE, SYNC_STATE_FORMAT, systemAuthor } from "./types.js";
export type {
  ConflictPolicy,
  DeletedConflict,
  FieldConflict,
  GuestsKept,
  LinkResolver,
  PassKept,
  RemoteAck,
  RemoteChange,
  RemoteLink,
  RemoteSystem,
  RemoteWrite,
  ResourceMapping,
  SyncConflict,
  SyncMapping,
  SyncState,
} from "./types.js";
